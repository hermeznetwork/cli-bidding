# Guide:

1. Edit the `config/.env.example` with your ethereum node url, private key and Smart contract address and save it as `config/.env`
2. `npm install`
3. `node src/biddingCLI.js <command> <options>`

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
