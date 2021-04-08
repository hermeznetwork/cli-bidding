const path = require("path");
require("dotenv").config({path:path.join(__dirname, "../config/.env")});
const { ethers } = require("ethers");

var yargs = require("yargs")
  .usage(`
cli <command> <options> 

commands
========
    cli slotinfo
        get information about slots and current bidding price
    --startingSlot <slot>
        first slot to check current bidding price
    --endingSlot <slot>
        last slot to check current bidding price

    cli register
        register a coordinator
    --url <URL>
        coordinator URL

    cli bid <options>
        bid to single slot
    --slot <slot>
        slot number to bid
    --bidAmount <amount>
        bidding amount
    --usePermit
        enable permit feature (default true)
    --amount <amount>
        amount of tokens to transfer to the Auction
    --units <units>
        units in wich the minBid, maxBid, amount and bidAmount are expressed: wei or ether supported  (default wei)

    cli multibid <options>
        bid multiple slots
    --startingSlot <slot>
        first slot to bid
    --endingSlot <slot>
        last slot to bid
    --slotSets <bool[6]>
        set of slots to which the coordinator wants to bid
    --maxBid <amount>
        maximum bid that is allowed
    --minBid <amount>
        minimum that you want to bid
    --usePermit
        enable permit feature (default true)
    --amount <amount>
        amount of tokens to transfer to the Auction
    --units <units>
        units in wich the minBid, maxBid, amount and bidAmount are expressed: wei or ether supported  (default wei)
    cli getclaimablehez
        know how much HEZ tokens are pending to be claimed
    cli claimhez
        distribute the tokens pending to be claimed`)

.option("s", { alias: "slot", describe: "slot number to bid", type: "string", demandOption: false })
.option("b", { alias: "bidAmount", describe: "token address", type: "string", demandOption: false })
.option("a", { alias: "amount", describe: "amount of tokens to transfer to the Auction", type: "string", demandOption: false })
.option("s", { alias: "startingSlot", describe: "first slot to bid", type: "string", demandOption: false})
.option("e", { alias: "endingSlot", describe: "last slot to bid", type: "string", demandOption: false})
.option("ss", { alias: "slotSets", describe: "set of slots to which the coordinator wants to bid", type: "string", demandOption: false })
.option("max", { alias: "maxBid", describe: "maximum bid that is allowed", type: "string", demandOption: false })
.option("min", { alias: "minBid", describe: "minimum that you want to bid", type: "string", demandOption: false })
.option("p", { alias: "usePermit", describe: " enable permit feature (default true)", type: "boolean", demandOption: false, default: true })
.option("u", { alias: "units", describe: "choose unit type, wei or ether supported", type: "string", demandOption: false, default: "wei" });


const argv = yargs.argv;
const command = argv._[0] === undefined ? undefined: argv._[0].toUpperCase();
const url = argv.url;
const amount = argv.amount;
const slot = argv.slot;
const bidAmount = argv.bidAmount;
const startingSlot = argv.startingSlot;
const endingSlot = argv.endingSlot;
const slotSets = argv.slotSets ? slotSets.split(",") : [true, true, true, true, true, true];;
const maxBid = argv.maxBid;
const minBid = argv.minBid;
const usePermit = argv.usePermit;
const units = argv.units;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_ETHEREUM_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_CLI_BIDDING, provider)  
 
  // get auction protocol
  const artifactAuction = require(path.join(__dirname, `../config/artifacts/HermezAuctionProtocol.json`))
  const HermezAuctionContract = new ethers.Contract(process.env.HERMEZ_AUCTION_ADDRESS, artifactAuction.abi, provider);

  const artifactHEZ= require(path.join(__dirname, `../config/artifacts/ERC20Permit.json`))
  const HezContract = new ethers.Contract(process.env.HEZ_TOKEN_ADDRESS, artifactHEZ.abi, provider);

  const network = await provider.getNetwork();
  checkInputsCLI();

  if(command === "SLOTINFO") {
    const currentSlot = (await HermezAuctionContract.getCurrentSlotNumber()).toNumber();
    const closedSlots =  await HermezAuctionContract.getClosedAuctionSlots()
    console.log("Current slot: ", currentSlot);
    console.log("Closed slots: ", closedSlots);
    console.log("First biddable slot:", currentSlot + closedSlots);


    if (startingSlot && endingSlot) {
      for(let i = startingSlot; i <= endingSlot; i++) {
        const currentMinBid = (await HermezAuctionContract.getMinBidBySlot(i)).toString()
        console.log(`Minimum bid for ${i}: ${ethers.utils.formatEther(currentMinBid)} HEZ`)
      }
    }
  }

  if(command === "REGISTER") {
    // register coordinator
    const res = await HermezAuctionContract
      .connect(wallet)
      .setCoordinator(wallet.address, url);
      printEtherscanTx(res, network.chainId);
  }

  let dataPermit;
  if(command === "BID" || command === "MULTIBID") {
    // Create Permit Signature
    const nonce = await HezContract.nonces(wallet.getAddress());
    const deadline = ethers.constants.MaxUint256;

    let amountUnits = amount
    let bidAmountUnits = bidAmount
    let maxBidUnits = maxBid
    let minBidUnits = minBid
    if (units == "ether") {
      amountUnits = ethers.utils.parseEther(amount);
      bidAmountUnits = ethers.utils.parseEther(bidAmount);
      maxBidUnits = ethers.utils.parseEther(maxBid);
      minBidUnits = ethers.utils.parseEther(minBid);
    }

    dataPermit = "0x";
    if(usePermit) {
      const {v,r,s} = await createPermitSignature(
        HezContract,
        wallet,
        HermezAuctionContract.address,
        amountUnits,
        nonce,
        deadline
      );
  
      const ABIbid = [
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
      ];
      const iface = new ethers.utils.Interface(ABIbid);

      dataPermit = iface.encodeFunctionData("permit", [
        wallet.address,
        HermezAuctionContract.address,
        amountUnits,
        deadline,
        v,
        r,
        s
      ]);
    }
  }

  if(command === "BID") {
    const res = await HermezAuctionContract.connect(wallet).processBid(
      amountUnits, 
      slot,
      bidAmountUnits,
      dataPermit
    );
    printEtherscanTx(res, network.chainId);
  }
  else if(command === "MULTIBID") {
    const res = await HermezAuctionContract.connect(wallet).processMultiBid(
      amountUnits, 
      startingSlot,
      endingSlot,
      slotSets,
      maxBidUnits,
      minBidUnits,
      dataPermit
    );

    printEtherscanTx(res, network.chainId);
  }
  else if(command === "GETCLAIMABLEHEZ") {
    const res = await HermezAuctionContract.connect(wallet).getClaimableHEZ(wallet.address);
    console.log(res.toString());
  }
  else if(command === "CLAIMHEZ") {
    const res = await HermezAuctionContract.connect(wallet).claimHEZ();
    console.log(await res.wait())
  }
}

function checkInputsCLI() {
  switch (command) {
  case "REGISTER":
    checkParamsRegister();
    break;
  case "BID":
    checkParamsBid();
    break;
  case "MULTIBID":
    checkParamsMultiBid();
    break;
  case "GETCLAIMABLEHEZ":
    break;
  case "CLAIMHEZ":
    break;
  case "SLOTINFO":
    break;
  default:
    yargs.showHelp();
  }
}


function checkParamsRegister() {
  checkParam(url, "url");
}

function checkParamsBid() {
  checkParam(amount, "amount");
  checkParam(slot, "slot");
  checkParam(bidAmount, "bidAmount");
  if (units != "wei" && units != "ether") {
    throw new Error("units must be ether or wei, default: wei");
  }
  
}

function checkParamsMultiBid() {
  checkParam(amount, "amount");
  checkParam(startingSlot, "startingSlot");
  checkParam(endingSlot, "endingSlot");
  checkParam(maxBid, "maxBid");
  checkParam(minBid, "minBid");
  checkParam(slotSets, "slotSets");

  if (units != "wei" && units != "ether") {
    throw new Error("units must be ether or wei, default: wei");
  }
  
  if(slotSets.length != 6) {
    console.log("slotSets must have 6 positions\n\n");
    throw new Error("Incorrect parameters");
  }
}

function checkParam(param, name) {
  if (param === undefined) {
    console.log(`It is necessary to specify ${name}\n\n`);
    throw new Error("Missing parameters");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

function printEtherscanTx(res, chainId) {
  if(chainId == 1) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://etherscan.io/tx/${res.hash}`)
  } else if(chainId == 4) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://rinkeby.etherscan.io/tx/${res.hash}`)
  } else if(chainId == 5) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://goerli.etherscan.io/tx/${res.hash}`)
  } else {
    console.log("Transaction receipt")
    printEtherscanTx(res, network.chainId);
  }
}  

async function createPermitSignature(hardhatToken, wallet, spenderAddress, value, nonce, deadline) {
  const digest = await createPermitDigest(
    hardhatToken,
    await wallet.getAddress(),
    spenderAddress,
    value,
    nonce,
    deadline
  );

  // must be a wallet not a signer!
  const ownerPrivateKey = wallet.privateKey;
  let signingKey = new ethers.utils.SigningKey(ownerPrivateKey);

  let {
    v,
    r,
    s
  } = signingKey.signDigest(digest);

  return {
    v,
    r,
    s,
  };
}
  

const PERMIT_TYPEHASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"));
async function createPermitDigest(token, owner, spender, value, nonce, deadline) {
  const chainId = (await token.getChainId());
  const name = await token.name();
  let _domainSeparator = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
          )
        ),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name)),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")),
        chainId,
        token.address,
      ]
    )
  );

  return ethers.utils.solidityKeccak256(
    ["bytes1", "bytes1", "bytes32", "bytes32"],
    [
      "0x19",
      "0x01",
      _domainSeparator,
      ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
      ))
    ]);
}

