const {expect} = require("chai");
const ethers = require("ethers");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

// paths
const pathCLI = path.join(__dirname, "../src/biddingCLI.js");
const enviromentPath =  path.join(__dirname, "../config/.env");
const addressSCPath =  path.join(__dirname, "../config/addressSC.json");

describe("Bidding CLI test", function() {
    this.timeout(10000);

    let HezContract, auctionContract, envOriginal;

    const addressSCOriginal = require(addressSCPath);
    if (fs.existsSync(enviromentPath)) {
        envOriginal = fs.readFileSync(enviromentPath);
    }

    before("Deploy smart contracts and write configuration files", async () => {
        const urlEtheruemNode = "http://127.0.0.1:8545";
        const provider = new ethers.providers.JsonRpcProvider(urlEtheruemNode);
        const ganachePrivateKey = "0x18e089fe6f2744011ec6eb0591cbdbc68d57613af11830de86ade3c90481fa6f";
        const wallet = new ethers.Wallet(ganachePrivateKey, provider);
        const signerGanache =  await provider.getSigner();

        const artifactAuction = require(path.join(__dirname, "../config/artifacts/HermezAuctionProtocol.json"));
        const HermezAuctionFactory = new ethers.ContractFactory(artifactAuction.abi, artifactAuction.bytecode, signerGanache);

        const artifactHEZ= require(path.join(__dirname, "../config/artifacts/ERC20Permit.json"));
        const HezFactory = new ethers.ContractFactory(artifactHEZ.abi, artifactHEZ.bytecode, signerGanache);

        // Deploy HEZ
        const tokenInitialAmount = ethers.BigNumber.from(
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
        );
        HezContract = await HezFactory.deploy(
            "HEZ token",
            "HEZ",
            wallet.address,
            tokenInitialAmount
        );
        await HezContract.deployed();

        // Deploy auction
        const addressZero = "0x0000000000000000000000000000000000000001";
        auctionContract = await HermezAuctionFactory.deploy();
        await auctionContract.deployed();

        const currentBlock = await provider.getBlockNumber();
        await auctionContract.hermezAuctionProtocolInitializer(
            HezContract.address,
            currentBlock + 2,
            addressZero,
            addressZero,
            addressZero,
            addressZero,
            "mockURL"
        );

        // Add funds to the wallet address
        const signerNode =  await provider.getSigner();
        const params = [{
            from: await signerNode.getAddress(),
            to: wallet.address,
            value: "0xDE0B6B3A7640000", // 1 ether
        }];
        const tx = await provider.send("eth_sendTransaction", params);
        await provider.waitForTransaction(tx);

        // Setup configuration files
        const addressSCGanache = Object.assign({}, addressSCOriginal);
        addressSCGanache[1337] = {};
        addressSCGanache[1337].hermezAuctionAddress = auctionContract.address;
        addressSCGanache[1337].hezTokenAddress = HezContract.address;
        addressSCGanache[1337].networkName = "ganache";
        fs.writeFileSync(addressSCPath, JSON.stringify(addressSCGanache, null, 1));

        // .env file
        const envGanacheString =
`NODE_ETHEREUM_URL="${urlEtheruemNode}"
PRIVATE_KEY_CLI_BIDDING="${ganachePrivateKey}"
`;
        fs.writeFileSync(enviromentPath, envGanacheString);
    });

    after("Clean configuration files", async () => {
        fs.writeFileSync(addressSCPath, JSON.stringify(addressSCOriginal, null, 3));
        if(envOriginal) {
            fs.writeFileSync(enviromentPath, envOriginal);
        }
    });

    it("register", async () => {
        const command = spawnSync(`node ${pathCLI} register --url https://www.example.com`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("status: 1,")).to.be.true;
    });

    it("slotinfo", async () => {
        const command = spawnSync(`node ${pathCLI} slotinfo`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("Current slot:  0")).to.be.true;
        expect(command.stdout.includes("First biddable slot: 3")).to.be.true;
        expect(command.stdout.includes("Minimum bid for 3: 11.0 HEZ")).to.be.true;

        const commandRange = spawnSync(`node ${pathCLI} slotinfo --startingSlot 5 --endingSlot 6`, {
            shell: true,
            encoding: "utf8"
        });
        expect(commandRange.stdout.includes("Minimum bid for 5: 11.0 HEZ")).to.be.true;
        expect(commandRange.stdout.includes("Minimum bid for 6: 11.0 HEZ")).to.be.true;
    });

    it("bid", async () => {
        const command = spawnSync(`node ${pathCLI} bid --amount 11 --slot 100 --bidAmount 11`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("status: 1,")).to.be.true;
    });

    it("multiBid", async () => {
        const command = spawnSync(`node ${pathCLI} multibid --amount 200 --startingSlot 10 --endingSlot 14 --slotSet true,true,true,true,true,true --maxBid 40 --minBid 30`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("status: 1,")).to.be.true;
    });

    it("GetHezBalances", async () => {
        const command = spawnSync(`node ${pathCLI} GetHezBalances`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("Account balance HEZ: 87112285931760246646412")).to.be.true;
        expect(command.stdout.includes("Auction balance HEZ: 50.0")).to.be.true;
    });

    it("Claimhez", async () => {
        const command = spawnSync(`node ${pathCLI} Claimhez`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("status: 1,")).to.be.true;

        const commandGetBalancesc = spawnSync(`node ${pathCLI} GetHezBalances`, {
            shell: true,
            encoding: "utf8"
        });
        expect(commandGetBalancesc.stdout.includes("Auction balance HEZ: 0.0")).to.be.true;
    });

    it("currentwinningbids", async () => {
        const command = spawnSync(`node ${pathCLI} currentwinningbids`, {
            shell: true,
            encoding: "utf8"
        });
        expect(command.stdout.includes("Slot : 10 bidAmount: 30.0 HEZ")).to.be.true;
        expect(command.stdout.includes("Slot : 11 bidAmount: 30.0 HEZ")).to.be.true;
        expect(command.stdout.includes("Slot : 12 bidAmount: 30.0 HEZ")).to.be.true;
        expect(command.stdout.includes("Slot : 13 bidAmount: 30.0 HEZ")).to.be.true;
        expect(command.stdout.includes("Slot : 14 bidAmount: 30.0 HEZ")).to.be.true;
        expect(command.stdout.includes("Slot : 100 bidAmount: 11.0 HEZ")).to.be.true;
    });
});
