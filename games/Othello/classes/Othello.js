import Game from '../../_Game/main.js'
import options from '../../../config/options.js'
import metadata from '../metadata.js'
import logger from 'gamebot/logger'

import othello from 'reversi';
const OthelloGame = othello.Game;
const PIECE_TYPES = othello.PIECE_TYPES;

import canvas from '@napi-rs/canvas'
const { createCanvas, loadImage } = canvas

import Discord from '../../../discord_mod.js'
import { AttachmentBuilder, time } from 'discord.js'

/**
 * The base class for Othello games.
 */
export default class Othello extends Game {
    constructor(msg, settings) {
        super(msg, settings)
        
        this.metadata = metadata

        // Generated in this.generateOptions()
        this.gameOptions = []

        this.game = new OthelloGame()
        this.board = this.game.board
        this.squares = this.board.squares
        this.side = 'Black'

        this.thisTurnEndsAt = -1

        this.defaultPlayer = {
            side: 'String'
        }

        this.moves = []
        
        this.over = false
        
    }

    async getShopMapping() {
        const collection = this.msg.client.database.collection('items')
        const pieces = await collection.find({ type: "Othello Pieces" }).toArray()
        const boards = await collection.find({ type: "Game Board" }).toArray()
        return { boards, pieces }
    }

    async generateStyleLists () {
        const map = await this.getShopMapping()
        let pieces = ['Basic']
        let boards = ['Basic']

        await this.gameMaster.fetchDBInfo().then(info => {
            // get unlocked items
            info.unlockedItems.forEach(id => {
                if(id.endsWith('_board')) {
                    boards.push(map.boards.find(item => item.itemID === id).friendlyName)
                }
            })
        }).catch(logger.error.bind(logger))
        return { pieces, boards }
    }

    async generateOptions() {
        let styles = await this.generateStyleLists()
        // Check unlocked styles
        this.gameOptions = [
            {
                friendlyName: 'Side',
                type: 'radio',
                choices: ['Random', 'Black', 'White'],
                default: 'Random',
                note: `The side that the game leader will play on.`
            },
            {
                friendlyName: 'Board Style',
                type: 'radio',
                choices: styles.boards,
                default: 'Basic',
                note: `Unlock more board styles in the shop!`
            },
            {
                friendlyName: 'Timer',
                type: 'free',
                default: 300,
                filter: m => !isNaN(parseInt(m.content)) && (parseInt(m.content) <= 1800) && (parseInt(m.content) >= 5),
                note: 'Enter a value in seconds for the move timer, between 5 and 1800 seconds.'
            },
        ]
    }

    /**
     * Initialize the game with its specific settings.
     */
    async gameInit() {
        
    }

    async giveMoveHelp(msg) {
        if(msg.content.toLowerCase().startsWith(`${this.channel.prefix}movehelp`)) {
            let attachment
            try {
                attachment = await this.renderBoard(this.side)
            } catch (err) {
                // Game hasn't fully initialized
                msg.channel.send({
                    embeds: [{
                        title: 'Error!',
                        description: 'Please wait for the game to begin before using this command.',
                        color: options.colors.error
                    }]
                })
                return
            }

            const columns = 'hgfedcba'
            const rows = '12345678'

            let placeableSquares = this.board.getPlaceableSquares(this.side.toUpperCase()).map(s => '`' + this.channel.prefix + columns[s._colIndex] + rows[s._rowIndex] + '`')

            let embed = new Discord.EmbedBuilder()
            .addFields([{
                name: 'Important Note:',
                value: `Remember to start all moves with the Gamebot's prefix, ${this.channel.prefix}.`
            }, {
                name: 'How do I enter my moves?',
                value: `Find the square you want to place your tile in. Look for its column letter, and look for its row number. For example, the top left square is h1, and the bottom right one is a8. Then, type ${this.channel.prefix}<letter><number>, and replace <letter> and <number> with your tile's letter and number.`
            }, {
                name: 'Possible moves',
                value: `The possible moves right now are: ${placeableSquares.join(',')}`
            }])
            .setFooter({ text: `Refer back to this anytime!` })
            .setColor(options.colors.info)

            if(attachment) embed.setImage(`attachment://image.png`)
            
            msg.channel.send({
                embeds: [embed],
                files: [ attachment ]
            })
        }
    }

    setSides() {
        // Use preset side for leader
        let side = this.options['Side']
        let leader = this.players.find(p => p.user.id === this.leader.id)
        let opponent = this.players.find(p => p.user.id !== this.leader.id)
        if(side == 'Random') {
            leader.side = Math.random() >= 0.5 ? 'Black' : 'White'
        } else {
            leader.side = side
        }

        // Set opponent to inverse
        opponent.side = leader.side == 'White' ?  'Black' : 'White'
    }

    renderBoard(side) {
        // Render board using canvas
        return new Promise(async (resolve, reject) => {
            try {
                const canvas = createCanvas(288, 288)
                const ctx = canvas.getContext('2d')

                // Draw border
                let border = await loadImage(`./games/Othello/assets/border/border.jpg`)
                ctx.drawImage(border, 0, 0, canvas.width, canvas.height)

                ctx.scale(0.5, 0.5)

                // Draw board
                let board = await loadImage(`./games/Othello/assets/boards/${this.options['Board Style']}.jpg`)
                ctx.drawImage(board, 32, 32, 512, 512)

                let piece = side == 'Black' ? PIECE_TYPES.BLACK : PIECE_TYPES.WHITE

                let placeableSquares = this.board.getPlaceableSquares(piece)

                // Draw pieces
                for(let row = 0; row < this.squares.length; row++) {
                    for(let col = 0; col < this.squares[row].length; col++) {
                        let square = this.squares[row][col]
                        const padding = 4,
                            x = (col + 1) * 64,
                            y = (row + 1) * 64,
                            width = 32 - padding,
                            height = 32 - padding,
                            rotation = 2 * Math.PI
                        if(placeableSquares.find(s => s._rowIndex === row && s._colIndex === col )) {
                            ctx.fillStyle = 'rgba(0, 0, 0, .2)'
                            ctx.beginPath()
                            ctx.ellipse(x, y, width, height, 0, 0, rotation)
                            ctx.fill()
                        } else if(square._pieceType == 'BLACK') {
                            ctx.fillStyle = 'black'
                            ctx.beginPath()
                            ctx.ellipse(x, y, width, height, 0, 0, rotation)
                            ctx.fill()
                        } else if(square._pieceType == 'WHITE') {
                            ctx.fillStyle = 'white'
                            ctx.beginPath()
                            ctx.ellipse(x, y, width, height, 0, 0, rotation)
                            ctx.fill()
                        }

                    }
                } 

                // Draw last move
                const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'image.png' });
                resolve(attachment)
            } catch (err) {
                reject(err)
            }
        })
    }

    getPlayer(side) {
        return this.players.find(player => player.side.toLowerCase() === side.toLowerCase())
    }

    async displayBoard(side) {
        let attachment = await this.renderBoard(side)
        let pieceCount = this.board.countByPieceType()
        let getPieces = (s) => pieceCount[s] +
                                (pieceCount[s] > pieceCount[PIECE_TYPES.BLACK]
                                && pieceCount[s] > pieceCount[PIECE_TYPES.WHITE] ? ' ⭐️' : '')

        let turnEndTime = Math.round(Date.now() / 1000 + parseInt(this.options['Timer']))

        let embed = new Discord.EmbedBuilder()
        .setDescription(`You have to make a move ${time(turnEndTime, 'R')}.`)
        .setFooter({ text: `Type ${this.channel.prefix}movehelp for help.` })
        .setImage(`attachment://image.png`)
        .setColor({ 'White': '#fffffe', 'Black': '#000001' }[side])
        .addFields([{
            name: 'Black ⚫️',
            value: `${getPieces(PIECE_TYPES.BLACK)}`,
            inline: true
        }, {
            name: 'White ⚪️',
            value: `${getPieces(PIECE_TYPES.WHITE)}`,
            inline: true
        }, {
            name: 'ℹ️',
            value: 'To make a move, enter the bot prefix followed by the name of the square.',
            inline: true
        },
        {
            name: '🏳',
            value: `Type \`${this.channel.prefix}resign\` to give up.`,
            inline: true
        }])

        this.client.metrics.log('Generated image', {
            game: this.metadata.id,
        })

        await this.channel.send({
            content: `${this.getPlayer(side).user}, it's your turn to move as ${side.toLowerCase()}!`,
            embeds: [embed],
            files: [ attachment ]
        }).catch(logger.error.bind(logger))
    }

    awaitMove(side) {
        return new Promise((resolve, reject) => {
            
            try {
                this.thisTurnEndsAt = Date.now() + parseInt(this.options['Timer']) * 1000
                const filter = m => m.content.startsWith(this.channel.prefix)
                                    && this.players.has(m.author.id) && m.author.id == this.getPlayer(side).user.id
                let collector = this.channel.createMessageCollector({ filter, time: parseInt(this.options['Timer']) * 1000 })
                collector.on('collect', m => {
                    if(this.ending || this.over) return
                    let move = m.content.replace(this.channel.prefix, '').toLowerCase()
                    const columns = 'hgfedcba'
                    const rows = '12345678'
                    let column = columns.indexOf(move[0])
                    let row = rows.indexOf(move[1])
                    let piece = side == 'Black' ? PIECE_TYPES.BLACK : PIECE_TYPES.WHITE

                    if(column > -1 && row > -1 && this.board.isPlaceableSquare(row, column, piece)) {
                        let report = this.game.proceed(row, column);
                        collector.stop('submitted')
                        resolve(report)
                    } else if(!['resign', 'timer', 'end'].includes(move.toLowerCase())) {
                        this.channel.send({
                            embeds: [{
                                title: 'Invalid move!',
                                description: 'Be sure to enter a valid move.',
                                color: options.colors.error
                            }]
                        })
                    }
                })

                collector.on('end', (collected, reason) => {
                    if(this.ending || this.over) return
                    // Handle time
                    if(reason == 'submitted') {
                        // Player made their move
                    } else {
                        // Player loses on time
                        this.channel.send({
                            embeds: [{
                                title: 'Time ran out!',
                                description: `${this.getPlayer(side).user} ran out of time and lost.`,
                                color: options.colors.error
                            }]
                        })
                        this.end(this.getPlayer(side == 'White' ? 'Black' : 'White'))
                    }
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    analyzeBoard(side) {
         if (this.game.isEnded) {
        const counts = this.board.countByPieceType();
        const blackCount = counts[PIECE_TYPES.BLACK];
        const whiteCount = counts[PIECE_TYPES.WHITE];

        let winnerSide = null;
        if (blackCount > whiteCount) winnerSide = 'Black';
        else if (whiteCount > blackCount) winnerSide = 'White';

        const winner = winnerSide ? this.getPlayer(winnerSide) : null;

        this.end(winner);
        this.over = true;
    }
}

    async play() {
        try {
            this.setSides()
            let move = 0;
            let sides = ['Black', 'White']
            while(!this.over) {
                this.side = sides[move % 2]
                // Display the board
                await this.displayBoard(this.side)
                // Move white
                let status = await this.awaitMove(this.side)
                if(status.isNextActorPassed)
                    move++
                this.analyzeBoard(this.side)
                
                move++
            } 
        } catch(err) {
            throw err
        }
    }
}

