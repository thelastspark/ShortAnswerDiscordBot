var needle = require('needle');
const cheerio = require('cheerio');
var MAIN = require('../scraper.js');
const User = require('../User.js');
const Guild = require('../Guild.js')

/** 
 * @params = [zone, player, guildID, channelID, returnInfo]
 * @zone = 'steam', 'ps', 'xbox'
 * @return = -1 for invalid player/zone or 
 * [ [Gamemode, Rank, Division]..... ]
*/
async function rocketLeagueRanks(params) {

    let resp = await needle('get', `https://rocketleague.tracker.network/profile/${params[0]}/${params[1]}`);
    if (resp.body.includes('We could not find your stats, please ensure your platform and name are correct')) {
        if (!params[4]) MAIN.Client.guilds.cache.get(params[2]).channels.cache.get(params[3]).send(`Could not find ${params[1]} on ${params[0]}`);
        return -1;
    }
    const $ = cheerio.load(resp.body);
    const CompleteTable = $('div.card-table-container').children();
    let finalContent = [];//[Gamemode, rank, division]
    for (let i = 0; i != CompleteTable.length; i++) {

        const season = CompleteTable[i];

        if (i == 0) {
            const row = season.children[3].children[3].children;

            for (let j = 3; j < row.length; j += 2) {
                const individual = row[j];
                const temp = cheerio.load(individual.children[2]);
                const specific = temp.text().split('\n').filter(value => value.length != 0);

                if (temp.html().includes("you have not played Rocket League")) {
                    finalContent.push([specific[0], 'Unranked']);
                }
                else {

                    const mmr = cheerio.load(individual.children[5]).text().trim().split("\n");
                    specific.push(mmr.splice(0, 1)[0]);
                    finalContent.push(specific);
                }
            }
        }
    }

    if (params[4]) {//Meaning it's called from RLTracker function (returns a different version of the information)

        let ranks = {};

        for (let i = 0; i < finalContent.length; i++) {

            let rank = finalContent[i];

            switch (i) {
                case 0:
                    if (rank.length == 4)
                        ranks.r1 = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.r1 = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 1:
                    if (rank.length == 4)
                        ranks.r2 = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.r2 = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 2:
                    if (rank.length == 4)
                        ranks.rs3 = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.rs3 = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 3:
                    if (rank.length == 4)
                        ranks.r3 = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.r3 = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 4:
                    if (rank.length == 4)
                        ranks.hoops = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.hoops = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 5:
                    if (rank.length == 4)
                        ranks.rumble = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.rumble = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 6:
                    if (rank.length == 4)
                        ranks.dropshot = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.dropshot = { rank: rank[1], division: -1, elo: -1 };
                    break;
                case 7:
                    if (rank.length == 4)
                        ranks.snowday = { rank: rank[1], division: rank[2], elo: rank[3] };
                    else
                        ranks.snowday = { rank: rank[1], division: -1, elo: -1 };
                    break;
            }
        }
        return ranks;
    }


    let finalArray = [];

    for (let rank of finalContent) {
        rank[0] = rank[0].replace('Standard', '');
        if (rank[1] == 'Unranked')
            finalArray.push({ name: rank[0], value: `${MAIN.getEmoji(`RL${rank[1]}`)} ${rank[1]}` })
        else {
            finalArray.push({ name: rank[0], value: `${MAIN.getEmoji(`RL${rank[1]}`)} ${rank[1]} : ${rank[2]} (${rank[3]})` })
        }
    }

    MAIN.prettyEmbed({ guildID: params[2], channelID: params[3] }, `Here are ${params[1]} 's stats:`, finalArray, -1, -1, -1);
    return 1;
}
exports.rocketLeagueRanks = rocketLeagueRanks;



/** 
 * @params = [zone, args[0], guild.RLTracker, ID]
*/
const RLTracker = async function (params) {

    let player = await rocketLeagueRanks([params[0], params[1], null, null, true]);

    if (player == -1) return -1;

    //channel = {player: , platform: , channelID: }
    for (channel of params[2]) {
        if (channel.id == params[4]) {
            if ((channel.player == params[1]) && (channel.platform == params[0])) {
                return -2;
            }
        }
    }

    params[2].push({ player: params[1], platform: params[0], channelID: params[3], ranks: player });
    return JSON.stringify({ RLTracker: params[2] });
}
exports.RLTracker = RLTracker;

const checkRLTrackers = async function (params) {



    for (let guild of params) {

        let tempGuild = guild;
        for (let link of guild.RLTracker) {

            let temp = link;
            let guildy = guild;
            rocketLeagueRanks([temp.platform, temp.player, null, null, true])
                .then((player) => {
                    if (player == -1) return;

                    //finalArray.push({ name: rank[0], value: `${MAIN.getEmoji(`RL${rank[1]}`)} ${rank[1]} : ${rank[2]} (${rank[3]})` })
                    let specificNotif = [];

                    if ((player.r1.elo != temp.ranks.r1.elo)) {

                        if ((temp.ranks.r1.elo > player.r1.elo)) {
                            specificNotif.push({
                                name: "Ranked Duel 1v1 Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.r1.rank}`)} ${temp.ranks.r1.rank} : ${temp.ranks.r1.division} (${temp.ranks.r1.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.r1.rank}`)} ${player.r1.rank} : ${player.r1.division} (${player.r1.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Ranked Duel 1v1 Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.r1.rank}`)} ${player.r1.rank} : ${player.r1.division} (${player.r1.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.r1.rank}`)} ${temp.ranks.r1.rank} : ${temp.ranks.r1.division} (${temp.ranks.r1.elo})`
                            });
                        }
                    }
                    if ((player.r2.elo != temp.ranks.r2.elo)) {

                        if ((temp.ranks.r2.elo > player.r2.elo)) {
                            specificNotif.push({
                                name: "Ranked Duel 2v2 Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.r2.rank}`)} ${temp.ranks.r2.rank} : ${temp.ranks.r2.division} (${temp.ranks.r2.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.r2.rank}`)} ${player.r2.rank} : ${player.r2.division} (${player.r2.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Ranked Duel 2v2 Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.r2.rank}`)} ${player.r2.rank} : ${player.r2.division} (${player.r2.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.r2.rank}`)} ${temp.ranks.r2.rank} : ${temp.ranks.r2.division} (${temp.ranks.r2.elo})`
                            });
                        }
                    }
                    if ((player.r3.elo != temp.ranks.r3.elo)) {

                        if ((temp.ranks.r3.elo > player.r3.elo)) {
                            specificNotif.push({
                                name: "Ranked 3v3 Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.r3.rank}`)} ${temp.ranks.r3.rank} : ${temp.ranks.r3.division} (${temp.ranks.r3.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.r3.rank}`)} ${player.r3.rank} : ${player.r3.division} (${player.r3.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Ranked 3v3 Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.r3.rank}`)} ${player.r3.rank} : ${player.r3.division} (${player.r3.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.r3.rank}`)} ${temp.ranks.r3.rank} : ${temp.ranks.r3.division} (${temp.ranks.r3.elo})`
                            });
                        }
                    }
                    if ((player.rs3.elo != temp.ranks.rs3.elo)) {

                        if ((temp.ranks.rs3.elo > player.rs3.elo)) {
                            specificNotif.push({
                                name: "Ranked Solor 3v3 Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.rs3.rank}`)} ${temp.ranks.rs3.rank} : ${temp.ranks.rs3.division} (${temp.ranks.rs3.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.rs3.rank}`)} ${player.rs3.rank} : ${player.rs3.division} (${player.rs3.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Ranked Solo 3v3 Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.rs3.rank}`)} ${player.rs3.rank} : ${player.rs3.division} (${player.rs3.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.rs3.rank}`)} ${temp.ranks.rs3.rank} : ${temp.ranks.rs3.division} (${temp.ranks.rs3.elo})`
                            });
                        }
                    }
                    if ((player.hoops.elo != temp.ranks.hoops.elo)) {

                        if ((temp.ranks.hoops.elo > player.hoops.elo)) {
                            specificNotif.push({
                                name: "Hoops Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.hoops.rank}`)} ${temp.ranks.hoops.rank} : ${temp.ranks.hoops.division} (${temp.ranks.hoops.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.hoops.rank}`)} ${player.hoops.rank} : ${player.hoops.division} (${player.hoops.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Hoops Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.hoops.rank}`)} ${player.hoops.rank} : ${player.hoops.division} (${player.hoops.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.hoops.rank}`)} ${temp.ranks.hoops.rank} : ${temp.ranks.hoops.division} (${temp.ranks.hoops.elo})`
                            });
                        }
                    }
                    if ((player.rumble.elo != temp.ranks.rumble.elo)) {

                        if ((temp.ranks.rumble.elo > player.rumble.elo)) {
                            specificNotif.push({
                                name: "Rumble 1v1 Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.rumble.rank}`)} ${temp.ranks.rumble.rank} : ${temp.ranks.rumble.division} (${temp.ranks.rumble.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.rumble.rank}`)} ${player.rumble.rank} : ${player.rumble.division} (${player.rumble.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Rumble Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.rumble.rank}`)} ${player.rumble.rank} : ${player.rumble.division} (${player.rumble.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.rumble.rank}`)} ${temp.ranks.rumble.rank} : ${temp.ranks.rumble.division} (${temp.ranks.rumble.elo})`
                            });
                        }
                    }
                    if ((player.dropshot.elo != temp.ranks.dropshot.elo)) {

                        if ((temp.ranks.dropshot.elo > player.dropshot.elo)) {
                            specificNotif.push({
                                name: "Dropshot Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.dropshot.rank}`)} ${temp.ranks.dropshot.rank} : ${temp.ranks.dropshot.division} (${temp.ranks.dropshot.elo}))`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.dropshot.rank}`)} ${player.dropshot.rank} : ${player.dropshot.division} (${player.dropshot.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Dropshot Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.dropshot.rank}`)} ${player.dropshot.rank} : ${player.dropshot.division} (${player.dropshot.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.dropshot.rank}`)} ${temp.ranks.dropshot.rank} : ${temp.ranks.dropshot.division} (${temp.ranks.dropshot.elo})`
                            });
                        }
                    }
                    if ((player.snowday.elo != temp.ranks.snowday.elo)) {

                        if ((temp.ranks.snowday.elo > player.snowday.elo)) {
                            specificNotif.push({
                                name: "Snowday Loss!" + ` Lost ${Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))} Elo`,
                                value: `${MAIN.getEmoji(`RL${temp.ranks.snowday.rank}`)} ${temp.ranks.snowday.rank} : ${temp.ranks.snowday.division} (${temp.ranks.snowday.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${player.snowday.rank}`)} ${player.snowday.rank} : ${player.snowday.division} (${player.snowday.elo})`
                            });
                        }
                        else {
                            specificNotif.push({
                                name: "Snowday Victory!" + ` Gained ${(Number(temp.ranks.r3.elo.replace(',', '')) - Number(player.r3.elo.replace(',', ''))) * -1} Elo`,
                                value: `${MAIN.getEmoji(`RL${player.snowday.rank}`)} ${player.snowday.rank} : ${player.snowday.division} (${player.snowday.elo})`
                                    + ` ➡️ ${MAIN.getEmoji(`RL${temp.ranks.snowday.rank}`)} ${temp.ranks.snowday.rank} : ${temp.ranks.snowday.division} (${temp.ranks.rsnowday1.elo})`
                            });
                        }
                    }

                    if (specificNotif.length == 0)
                        console.log("NO CHANGE")
                    else {

                        tempGuild.RLTracker[tempGuild.RLTracker.indexOf(temp)].ranks = player;
                        console.log("INITIAL CHANGE")
                        console.log(tempGuild.RLTracker);
                        Guild.findOneAndUpdate({ id: tempGuild.id }, { $set: { RLTracker: tempGuild.RLTracker } }, (err, doc, res) => { if(err)console.log(err)});
                        MAIN.prettyEmbed({ guildID: guildy.id, channelID: temp.channelID }, `Rocket League Update For **${temp.player}**:`,
                            specificNotif, -1, -1, -1, null, null, null, 1000);
                    }
                })
        }
    }

}
exports.checkRLTrackers = checkRLTrackers;