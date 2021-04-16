const path = require("path");
require("dotenv").config({path:path.join(__dirname, "../config/.env")});
const { ethers } = require("ethers");

var yargs = require("yargs")
  .usage(`
cli <command> <options>

commands
========
    cli register
       Register a coordinator in the auction
    --url <URL>
        coordinator URL

    cli slotinfo
        Display the information regarding the current open slots and current bidding price
      --startingSlot <slot>
          first slot to check current bidding price
      --endingSlot <slot>
          last slot to check current bidding price

    cli bid <options>
        Bid for a slot
    --slot <slot>
        slot number to bid
    --bidAmount <amount>
        bidding amount
    --usePermit
        enable permit feature (default true)
    --amount <amount>
        amount of tokens to transfer to the Auction
    --units <units>
        units in wich the minBid, maxBid, amount and bidAmount are expressed: wei or ether supported  (default ether)

    cli multibid <options>
        Bid for multiple slots
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
        units in wich the minBid, maxBid, amount and bidAmount are expressed: wei or ether supported  (default ether)

    cli getHezBalances
        Display the current HEZ balance of the ethereum account and inside the HermezAuction contract

    cli claimhez
      Claim the pending HEZ inside HermezAuction contract

    cli currentbids
       Display the current bids information starting from the actual slot, that were done by the wallet.
    --all <bool>
       true if the want to display all the current bids, false for only display the wallet current bids (default false)
`)

.option("url", { alias: "url", describe: "url of the coordinator", type: "string", demandOption: false })
.option("s", { alias: "slot", describe: "slot number to bid", type: "string", demandOption: false })
.option("b", { alias: "bidAmount", describe: "token address", type: "string", demandOption: false })
.option("a", { alias: "amount", describe: "amount of tokens to transfer to the Auction", type: "string", demandOption: false })
.option("st", { alias: "startingSlot", describe: "first slot to bid", type: "string", demandOption: false})
.option("e", { alias: "endingSlot", describe: "last slot to bid", type: "string", demandOption: false})
.option("ss", { alias: "slotSets", describe: "set of slots which the coordinator wants to bid", type: "string", demandOption: false })
.option("max", { alias: "maxBid", describe: "maximum bid that is allowed", type: "string", demandOption: false })
.option("min", { alias: "minBid", describe: "minimum that you want to bid", type: "string", demandOption: false })
.option("p", { alias: "usePermit", describe: "enable permit feature (default true)", type: "boolean", demandOption: false, default: true })
.option("u", { alias: "units", describe: "choose unit type, wei or ether supported", type: "string", demandOption: false, default: "ether" })
.option("all", { alias: "all", describe: "bool if the user want to display only his bids or all the current bids", type: "bool", demandOption: false, default: false });


const argv = yargs.argv;
const command = argv._[0] === undefined ? undefined: argv._[0].toUpperCase();
const url = argv.url;
const slot = argv.slot;
const startingSlot = argv.startingSlot;
const endingSlot = argv.endingSlot;
const slotSets = argv.slotSets ? slotSets.split(",") : [true, true, true, true, true, true];
const usePermit = argv.usePermit;
const units = argv.units;
const allBool = argv.all;

let amount = argv.amount;
let bidAmount = argv.bidAmount;
let maxBid = argv.maxBid;
let minBid = argv.minBid;

if (units == "ether") {
  amount = amount ? ethers.utils.parseEther(amount) : undefined;
  bidAmount = bidAmount ? ethers.utils.parseEther(bidAmount): undefined;
  maxBid = maxBid ? ethers.utils.parseEther(maxBid) : undefined;
  minBid = minBid ? ethers.utils.parseEther(minBid) : undefined;
}

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

  if (command === "SLOTINFO") {
    const currentSlot = (await HermezAuctionContract.getCurrentSlotNumber()).toNumber();
    const closedSlots =  await HermezAuctionContract.getClosedAuctionSlots()
    const firstBiddableSlot = currentSlot + closedSlots + 1
    console.log("Current slot: ", currentSlot);
    console.log("Closed slots: ", closedSlots);
    console.log("First biddable slot:", firstBiddableSlot);


    if (startingSlot && endingSlot) {
      for(let i = startingSlot; i <= endingSlot; i++) {
        const currentMinBid = (await HermezAuctionContract.getMinBidBySlot(i)).toString()
        console.log(`Minimum bid for ${i}: ${ethers.utils.formatEther(currentMinBid)} HEZ`)
      }
    } else {
      console.log("First 5 biddable slots:");
      for(let i = firstBiddableSlot; i < firstBiddableSlot + 5; i++) {
        const currentMinBid = (await HermezAuctionContract.getMinBidBySlot(i)).toString()
        console.log(`Minimum bid for ${i}: ${ethers.utils.formatEther(currentMinBid)} HEZ`)
      }
    }
  }

  if (command === "CURRENTBIDS") {
    const currentSlot = (await HermezAuctionContract.getCurrentSlotNumber()).toNumber();
    const slots = {};

    if (allBool) {
      const filter = HermezAuctionContract.filters.NewBid(null, null, null);
      let eventsBid = await HermezAuctionContract.queryFilter(filter, 0, "latest");
      for( let i = 0; i < eventsBid.length; i++) {
        const slot = eventsBid[i].args.slot
        if (slot > currentSlot && !slots[slot]) {
          const slotState = await HermezAuctionContract.slots(slot) 
          slots[slot] = slotState.bidAmount;
        }
      }
    } else {
      const filter = HermezAuctionContract.filters.NewBid(null, null, wallet.address);
      let eventsBid = await HermezAuctionContract.queryFilter(filter, 0, "latest");
      for( let i = 0; i < eventsBid.length; i++) {
        const slot = eventsBid[i].args.slot
        if (slot > currentSlot && !slots[slot]) {
          const slotState = await HermezAuctionContract.slots(slot) 
          if (slotState.bidder == wallet.address) {
            slots[slot] = slotState.bidAmount;
          }
        }
      }
    }
    console.log("current slots bidded")
    Object.keys(slots).forEach( slot => {
      console.log(`Slot : ${slot} bidAmount: ${ethers.utils.formatEther(slots[slot])} HEZ`)
    });
  }

  if(command === "REGISTER") {
    // register coordinator
    const res = await HermezAuctionContract
      .connect(wallet)
      .setCoordinator(wallet.address, url);
      printEtherscanTx(res, network.chainId);
  }

  let dataPermit = "0x";

  if(command === "BID" || command === "MULTIBID") {
    // Create Permit Signature
    const nonce = await HezContract.nonces(wallet.getAddress());
    const deadline = ethers.constants.MaxUint256;
    if(usePermit) {
      const {v,r,s} = await createPermitSignature(
        HezContract,
        wallet,
        HermezAuctionContract.address,
        amount,
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
        amount,
        deadline,
        v,
        r,
        s
      ]);
    }
  }

  if(command === "BID") {
    try {
      const res = await HermezAuctionContract.connect(wallet).processBid(
        amount,
        slot,
        bidAmount,
        dataPermit
      );
      printEtherscanTx(res, network.chainId);
    } catch (error) {
      console.log("gas estimation failed")
      const jsonError = JSON.parse(error.error.error.body);
      throw new Error(jsonError.error.message);
    }
  }
  else if(command === "MULTIBID") {
    try {
      const res = await HermezAuctionContract.connect(wallet).processMultiBid(
        amount,
        startingSlot,
        endingSlot,
        slotSets,
        maxBid,
        minBid,
        dataPermit
      );
      printEtherscanTx(res, network.chainId);
    } catch (error) {
      console.log("gas estimation failed")
      const jsonError = JSON.parse(error.error.error.body);
      throw new Error(jsonError.error.message);
    }
  }
  else if(command === "GETHEZBALANCES") {

    const accountHez = await HezContract.connect(wallet).balanceOf(wallet.address);
    const auctionHez= await HermezAuctionContract.connect(wallet).pendingBalances(wallet.address);

    console.log(`Account balance HEZ: ${ethers.utils.formatEther(accountHez)}`);
    console.log(`Auction balance HEZ: ${ethers.utils.formatEther(auctionHez)}`);
  }
  else if(command === "CLAIMHEZ") {
    try {
      const res = await HermezAuctionContract.connect(wallet).claimHEZ();
      printEtherscanTx(res, network.chainId);
    } catch (error) {
      console.log("gas estimation failed")
      const jsonError = JSON.parse(error.error.error.body);
      throw new Error(jsonError.error.message);
    }
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
  case "GETHEZBALANCES":
    break;
  case "CLAIMHEZ":
    break;
  case "SLOTINFO":
    break;
  case "CURRENTBIDS":
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
    throw new Error("units must be ether or wei, default: ether");
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
    throw new Error("units must be ether or wei, default: ether");
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

async function printEtherscanTx(res, chainId) {
  if(chainId == 1) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://etherscan.io/tx/${res.hash}`)
  } else if(chainId == 4) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://rinkeby.etherscan.io/tx/${res.hash}`)
  } else if(chainId == 5) {
    console.log("Transaction submitted, you can see it here:")
    console.log(`https://goerli.etherscan.io/tx/${res.hash}`)
  } else { // suppose test enviroment
    console.log("Transaction receipt")
    console.log(await res.wait());
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

