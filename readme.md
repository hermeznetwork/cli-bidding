# Quick Guide:

1. Edit the `config/.env.example` with your ethereum node url, private key of the bidded account and Smart contract address and save it as `config/.env`
```
    NODE_ETHEREUM_URL=<you_ethereum_node>
    PRIVATE_KEY_CLI_BIDDING=<your_private_key>
    HERMEZ_AUCTION_ADDRESS=<Hermez_auction_address>
    HEZ_TOKEN_ADDRESS=<Hez_token_address>
```
2. `npm install`
3. `node src/biddingCLI.js register --url http://www.example.comss`
4. `node src/biddingCLI.js register --url http://www.example.comss`
5. `node src/biddingCLI.js slotinfo`
6. `node src/biddingCLI.js bid --amount Y --slot X --bidAmount Y --units ether`

## Examples

### register

`node src/biddingCLI.js register --url http://www.example.com`

### slot information

`node src/biddingCLI.js slotinfo`
`node src/biddingCLI.js slotinfo --startingSlot 4150 --endingSlot 4170`
### bid

`node src/biddingCLI.js bid --amount 1000000000000000000 --slot 100 --bidAmount 1000000000000000000`

`node src/biddingCLI.js bid --amount 1 --slot 100 --bidAmount 1 --units ether`
#### multibid

`node src/biddingCLI.js multibid --amount 1 --startingSlot 22 --endingSlot 27 --slotSet true,true,true,true,false,false --maxBid 3 --minBid 3 --units ether`
