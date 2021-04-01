const path = require("path");
require("dotenv").config({path:path.join(__dirname, "../config/.env")});
const { ethers } = require("ethers");
const pathDeployOutputParameters = path.join(__dirname, "../config/deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

var yargs = require("yargs")
  .usage(`
cli <command> <options> 

commands
========
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
.option("p", { alias: "usePermit", describe: " enable permit feature (default true)", type: "boolean", demandOption: false, default: true });


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

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_ETHEREUM_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_CLI_BIDDING, provider)  
 
  // get auction protocol
  const artifactAuction = require(path.join(__dirname, `../config/artifacts/HermezAuctionProtocol.json`))
  const HermezAuctionContract = new ethers.Contract(deployOutputParameters.hermezAuctionProtocolAddress, artifactAuction.abi, provider);

  const artifactHEZ= require(path.join(__dirname, `../config/artifacts/ERC20Permit.json`))
  const HezContract = new ethers.Contract(deployOutputParameters.HEZTokenAddress, artifactHEZ.abi, provider);

  checkInputsCLI();
  if(command === "REGISTER") {
    // register coordinator
    const res = await HermezAuctionContract
      .connect(wallet)
      .setCoordinator(wallet.address, url);

    console.log(await res.wait());
  }

  let dataPermit;
  if(command === "BID" || command === "MULTIBID") {
    // Create Permit Signature
    const nonce = await HezContract.nonces(wallet.getAddress());
    const deadline = ethers.constants.MaxUint256;

    dataPermit = "0x";
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
    const res = await HermezAuctionContract.connect(wallet).processBid(
      amount, 
      slot,
      bidAmount,
      dataPermit
    );
    console.log(await res.wait());
  }
  else if(command === "MULTIBID") {
    const res = await HermezAuctionContract.connect(wallet).processMultiBid(
      amount, 
      startingSlot,
      endingSlot,
      slotSets,
      maxBid,
      minBid,
      dataPermit
    );

    console.log(await res.wait());
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
  case undefined:
    yargs.showHelp();
    throw new Error("A valid command must be used");
  default:
    throw new Error(`${command} is not valid`);
  }
}

function checkParamsRegister() {
  checkParam(url, "url");
}

function checkParamsBid() {
  checkParam(amount, "amount");
  checkParam(slot, "slot");
  checkParam(bidAmount, "bidAmount");
}

function checkParamsMultiBid() {
  checkParam(amount, "amount");
  checkParam(startingSlot, "startingSlot");
  checkParam(endingSlot, "endingSlot");
  checkParam(maxBid, "maxBid");
  checkParam(minBid, "minBid");
  checkParam(slotSets, "slotSets");

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

