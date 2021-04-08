# Guide:

1. Edit the `config/.env.example` with your ethereum node url, private key and Smart contract address and save it as `config/.env`
2. `npm install`
3. `node src/biddingCLI.js <command> <options>`

## Examples

### register

`node src/biddingCLI.js register --url http://www.example.com`

### bid

`node src/biddingCLI.js bid --amount 1000 --slot 100 --bidAmount 1000`

#### multibid

`node src/biddingCLI.js multibid --amount 1000 --startingSlot 22 --endingSlot 27 --slotSet true,true,true,true,false,false --maxBid 11 --minBid 11`
