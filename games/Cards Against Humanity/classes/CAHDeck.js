const { whiteCards, blackCards } = require('../assets/cards')
const BlackCard = require('./BlackCard')

module.exports = class CAHDeck {
    constructor(sets) {
        // adds all appropriate sets to the collection of cards
        this.sets = sets.length == 0 ? ['Base Set'] : sets
        this.whiteCards = []
        this.blackCards = []
        this.discards = {
            white: [],
            black: []
        }
        this.blackCard = new BlackCard('')
        this.sets.forEach(set => {
            whiteCards.find((cards, metadata) => metadata.name == set).forEach(card => this.whiteCards.push(card))
            blackCards.find((cards, metadata) => metadata.name == set).forEach(card => this.blackCards.push(card))
        })
    }

    // shuffles an array
    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // shuffles both decks
    shuffle (options) {
        this.constructor.shuffleArray(this.whiteCards)
        this.constructor.shuffleArray(this.blackCards)
    }

    // draws the top card(s) from the deck
    draw (deck, count) {
        count = isNaN(count) ? 1 : count
        if(deck == 'white') deck = this.whiteCards
        if(deck == 'black') deck = this.blackCards
        var drawCards = deck.slice(0, count)
        deck.splice(0, count)
        return drawCards
    }

    // discards a card
    discard (deck, cards) {
        if(deck == 'white') this.discards.white.concat(cards)
        if(deck == 'black') this.discards.black.concat(cards)
    }
}

module.exports.sets = []