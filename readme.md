# Table of Contents
1. [Quick Guide](#1)
2. [Auction](#9)
3. [Usage](#2)

## Quick Guide <a id="1"></a>

1. Edit the `config/.env.example` and save it as `config/.env`:
    ```
        NODE_ETHEREUM_URL=<you_ethereum_node>
        PRIVATE_KEY_CLI_BIDDING=<your_private_key>
        HERMEZ_AUCTION_ADDRESS=<Hermez_auction_address>
        HEZ_TOKEN_ADDRESS=<Hez_token_address>
    ```
    >your `PRIVATE_KEY_CLI_BIDDING` should have `ether` to pay the gas for the ethereum transactions and `HEZ` to pay the bid costs
2. `npm i`
3. Register an operator in the auction with: `node src/biddingCLI.js register --url http://www.example.com`
4. Display the information regarding the current open slots and current bidding price with: `node src/biddingCLI.js slotinfo`
5. Bid for a slot X with Y amount: `node src/biddingCLI.js bid --amount Y --slot X --bidAmount Y`

 -----
 -----

## Auction <a id="9"></a>

The auction is the forging consensus protocol of Hermez.
In order to forge a batch in Hermez, a coordinator must bid for a `slot` which is a period of 40 ethereum blocks.
The best bid wins the slot and therefore has the right to forge as many [batches](https://docs.hermez.io/#/developers/glossary?id=batch) as possible in that period.
This cli aims to easily interact with the Hermez Auction smart contract to facilitate this bidding task.
Further information on the auction mechanism could be found in [documentation](https://docs.hermez.io/#/developers/protocol/consensus/consensus?id=auction)

 -----
 -----

## Usage <a id="2"></a>

### Commands
- [register](#3): Register a coordinator in the HermezAuction contract
- [slotinfo](#4): Display the information regarding the current open slots and current bidding price
- [bid](#5):  Bid for a slot
- [multibid](#6): Bid for multiple slots
- [getHezBalances](#7): Display the current HEZ balance of the ethereum account and balance inside the HermezAuction contract
- [claimhez](#8): Claim the HEZ inside HermezAuction contract

### Register <a id="3"></a>
Register a coordinator in the auction with a given URL. In order to make bids a coordinator must be registered first

#### Options
- URL `[--url] <URL>`

```bash=
node src/biddingCLI.js register --url http://www.example.com
```

### Slotinfo  <a id="4"></a>
Display the information regarding the current open slots and current bidding price.
Optionally, a `startingSlot` and `endingSlot` to check the bidding price for that slot range. The range must be inside the `openSlots`.

If no slots range is specified, the 5 first open slots will be displayed.
HEZ costs are displayed multiplied by its number of decimals which is 18

#### Options
- startingSlot `[--st | --startingSlot] <slot>` (optional)
- endingSlot `[-e | --endingSlot] <slot>` (optional)


```bash=
node src/biddingCLI.js slotinfo --startingSlot 4150 --endingSlot 4170
```

or

```bash=
node src/biddingCLI.js slotinfo
```

### Bid  <a id="5"></a>
Bid for a especific `slot`. The `bidAmount` is the HEZ amount that will be bidded for that `slot`. The `amount` is the HEZ that will be transfer to the HermezAuction smart contract
The `amount` and `bidAmount` are different parameters because there's some cases when the user could choose to not transfer HEZ to the auction (`amount = 0`) because there's already enough pending balance in the contract (see [getHezBalances](#7)).

By default the `permit` option is active which means that the the bid transaction will do also an `approve` of tokens.
In case that the user already approve enough tokens to make the `amount` transfer, is not necessary to activate this option

The units are by default `ether`, this means that all the amounts are multiplied by `1e18`. The user could choose `wei` instead, where the amounts are not multiplied.

#### Options
- slot `[-s | --slot] <slot>`
- bidAmount `[-b | --bidAmount] <token amount>`
- amount `[-a | --amount] <token amount>`
- usePermit `[-p | --usePermit] <bool>` (default: `true`)
- units `[-u | --units] <"ether" || "wei">` (default: `ether`)
)

```bash=
node src/biddingCLI.js bid --amount 1 --slot 100 --bidAmount 1
```
or equivalent:
```bash=
node src/biddingCLI.js bid --amount 1000000000000000000 --slot 100 --bidAmount 1000000000000000000 --units "wei"
```

### MultiBid  <a id="6"></a>
Bid for a set of slots.
User must define the `StartingSlot` and `endingSlot`. The call will bid for that range of slots, both included.

The `maxBid` parameter will be the maximum amount of HEZ that the user is willing to pay for a slot, and the `minBid` the minimum HEZ.
The Smart contract will choose always the minimum value between `minBid < value <= maxBid` to bid for each slot. If a slot cost more than the `maxBid`, the smart contract will skip that slot, and will bid for the rest.

Optionally, user can define the `slotSets` which can choose if he want to bid for a especific set of slots. There's 6 set of slots in the HermezAuction, every one of each could have a different minimum bids and therefore different HEZ price. That's why the user could want only bid for the "cheap" ones for example. Let's say, coordinator only want to bid for the `slotSet 1 & slotSet 2`, he should input the following `slotSets`:
`--slotSets false,true,true,false,false,false`

The `amount` is the HEZ that will be transfered to the HermezAuction smart contract.
User must be aware that the sum of the bidding of all the slots must be bigger or equal than the amount plus the pending balance in the auction:
`HEZ cost of all slots <= amount + pendingBalance`

By default the `permit` option is active which means that the the bid transaction will do also an `approve` of tokens.
In case that the user already approve enough tokens to make the `amount` transfer, is not necessary to activate this option.

The units are by default `ether`, this means that all the amounts are multiplied by `1e18`. The user could choose `wei` instead, where the amounts are not multiplied.

#### Options
- startingSlot `[--st | --startingSlot] <slot>`
- endingSlot `[-e | --endingSlot] <slot>`
- slotSets `[--ss | --slotSets] <bool[6]>` (optional)
- maxBid `[--max | --maxBid] <token amount>`
- minBid `[--min | --minBid] <token amount>`
- amount `[-a | --amount] <token amount>`
- usePermit `[-p | --usePermit] <bool>` (default: true)
- units `[-u | --units] <"ether" || "wei">` (default: "ether")

)

```bash=
node src/biddingCLI.js multibid --amount 10 --startingSlot 22 --endingSlot 27 --slotSet true,true,true,true,false,false --maxBid 4 --minBid 3
```


### GetHezBalances  <a id="7"></a>
Display the current HEZ balance of the ethereum account and balance inside the HermezAuction contract

```bash=
node src/biddingCLI.js getHezBalances
```

### Claimhez  <a id="8"></a>
Claim the pending HEZ inside HermezAuction contract

```bash=
node src/biddingCLI.js claimhez
```
