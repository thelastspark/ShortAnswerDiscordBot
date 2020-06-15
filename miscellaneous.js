
const Fuse = require('fuse.js');
const studyJSON = require('./medstudy.json');
const MAIN = require('./short-answer.js');
const config = require('./config.json');
const User = require('./User.js');
const Guild = require('./Guild.js')
const studyArray = new Array();

for (let element of studyJSON)
    studyArray.push(element);



async function updateTwitchFollows(message, params, user) {

    let args = params.custom ? params.url : message.content.split(" ").slice(1).join(" ");

    if (!args) return message.channel.send("You have to write the name of the streamer you wish to follow!");
}

async function getTwitchChannel(streamer) {
    const user = await MAIN.twitchClient.helix.users.getUserByName(streamer);
    return user;
}

async function getTwitchChannelByID(id) {
    const user = await MAIN.twitchClient.helix.users.getUserById(id);
    return user;
}

async function followTwitchChannel(message, params, user) {

    if (!user.twitchFollows) user.twitchFollow = [];
    let args = message.content.split(" ").slice(1).join(" ");

    let targetChannel = await getTwitchChannel(args);
    if (!targetChannel) return message.channel.send("I could not find such a channel, try again?");

    if (user.twitchFollows.includes(targetChannel._data.id)) return message.channel.send("You are already following that channel!");
    if (user.linkedTwitch == (targetChannel._data.id)) return message.channel.send("You can't follow your own linked twitch!");

    user.twitchFollows.push(targetChannel._data.id);
    User.findOneAndUpdate({ id: user.id }, { $set: { twitchFollows: user.twitchFollows } }, function (err, doc, res) { });
    return message.channel.send(`Succesfully added ${targetChannel._data.display_name} to your follow list!`);
}
exports.followTwitchChannel = followTwitchChannel;

async function unfollowTwitchChannel(message, params, user) {

    if (!user.twitchFollows) return message.channel.send("You do not have twitch channels being followed!");
    if (user.twitchFollows.length == 0) return message.channel.send("You do not have twitch channels being followed!");
    let args = message.content.split(" ").slice(1).join(" ");
    if (!args) return message.channel.send("You have to specify the name of the channel you wish to unfollow!");

    if (!params.looped) {
        let promiseArray = [];

        for (follow of user.twitchFollows)
            promiseArray.push(getTwitchChannelByID(follow));

        let finishedPromises = await Promise.all(promiseArray);

        let found = finishedPromises.find(element => element._data.display_name == args);

        let channelNames = [];
        let internalArray = [];

        for (channel of finishedPromises) {
            channelNames.push(channel._data.display_name);
            internalArray.push({ looped: true, channel: channel.id, name: channel._data.display_name });
        }

        if (!found) {
            return MAIN.generalMatcher(message, args, user, channelNames, internalArray, unfollowTwitchChannel, "Select which channel you meant to remove:");
        }
        else
            return unfollowTwitchChannel(message, { looped: true, channel: found.id, name: found._data.display_name }, user);
    }

    user.twitchFollows.splice(user.twitchFollows.indexOf(params.channel), 1);
    User.findOneAndUpdate({ id: user.id }, { $set: { twitchFollows: user.twitchFollows } }, function (err, doc, res) { });
    return message.channel.send(`Successfully removed ${params.name} from your follows!`);
}
exports.unfollowTwitchChannel = unfollowTwitchChannel;

async function viewTwitchFollows(message, params, user) {

    if (!user.twitchFollows) return message.channel.send("You do not have twitch channels being followed!");
    if (user.twitchFollows.length == 0) return message.channel.send("You do not have twitch channels being followed!");

    let promiseArray = [];

    for (follow of user.twitchFollows)
        promiseArray.push(getTwitchChannelByID(follow));

    let finishedPromises = await Promise.all(promiseArray);
    finishedPromises.sort((a, b) => { return b._data.view_count - a._data.view_count });

    MAIN.prettyEmbed(message, `You are following ${promiseArray.length} channels!`,
        finishedPromises.reduce((accum, current) => {
            accum.push({ name: '', value: `<${current._data.display_name} Views=${current._data.view_count}>\n` });
            return accum;
        }, []),
        -1, 1, 'md');
}
exports.viewTwitchFollows = viewTwitchFollows;

async function showChannelTwitchLinks(message, params, user) {

    let guild = await MAIN.findGuild({ id: message.guild.id });

    if (!guild.channelTwitch || (guild.channelTwitch.length == 0)) return message.channel.send("There are no pairs setup for this server!");

    let promiseArray = [];
    let textChannels = [];

    for (follow of guild.channelTwitch) {
        promiseArray.push(getTwitchChannelByID(follow[0]));
        textChannels.push(message.guild.channels.cache.get(follow[1]));
    }

    let finishedPromises = await Promise.all(promiseArray);

    let finishedArray = [];

    for (let i = 0; i < finishedPromises.length; i++) {
        finishedArray.push({ texty: textChannels[i], streamy: finishedPromises[i] });
    }

    finishedPromises.sort((a, b) => { return b.streamy._data.view_count - a.streamy._data.view_count });

    MAIN.prettyEmbed(message, "Here are the ServerChannel-TwitchStreamer pairs:",
        finishedArray.reduce((accum, current) => {
            accum.push({ name: '', value: `<#${current.texty.name} is linked to=${current.streamy._data.display_name}>\n` });
            return accum;
        }, []), -1, -1, 'md');
    return -1;
}
exports.showChannelTwitchLinks = showChannelTwitchLinks;

async function unlinkTwitch(message, params, user) {

    if (!user.linkedTwitch) return message.channel.send("You do not have a linked twitch, try linking one first?");

    if (user.twitchFollows && !params.looped) {
        if (user.twitchFollows.length > 0)
            if (!params.looped)
                return MAIN.generalMatcher(message, -23, user, ['Keep', 'Remove'],
                    [{ looped: true, keep: true, followArr: user.twitchFollows },
                    { looped: true, keep: false, followArr: [] }],
                    unlinkTwitch, "Do you want to keep your current follows?");
    }
    else {

        User.findOneAndUpdate({ id: user.id }, { $set: { linkedTwitch: null, twitchFollows: params.followArr } }, function (err, doc, res) { });
        return message.channel.send("Succesfully unlinked your twitch!" + ` You now have ${params.followArr.length} channels still being followed!`);
    }
}
exports.unlinkTwitch = unlinkTwitch;

async function linkTwitch(message, params, user) {

    let args = message.content.split(" ").slice(1).join(" ");
    if (!args) return message.channel.send("You did not provide the name of the channel you wish to link to!");
    let streamer = await getTwitchChannel(args);
    if (!streamer) return message.channel.send("I could not find a channel with that name, try again?");

    if (!params.looped) {

        let follows = await streamer.getFollows();
        let followIDs = [];
        if (follows)
            for (chan of follows.data)
                followIDs.push(chan._data.to_id);

        let goodArray = [];

        for (channy of followIDs) {
            let tester = await getTwitchChannelByID(channy);

            if (tester)
                goodArray.push(channy)
        }

        if (user.linkedTwitch && user.twitchFollows) {

            if (user.twitchFollows)
                return MAIN.generalMatcher(message, -23, user, ['Combine', 'Remove'],
                    [{ looped: true, keep: true, followArr: goodArray.concat(user.twitchFollows.filter(item => !followIDs.includes(item))) },
                    { looped: true, keep: false, followArr: goodArray }],
                    linkTwitch, "You already have a linked twitch account or channels you have followed, would you like to combine the old follows, or remove them?");
        }
        else {
            return linkTwitch(message, { looped: true, followArr: goodArray }, user);
        }
    }
    User.findOneAndUpdate({ id: user.id }, { $set: { linkedTwitch: streamer.id, twitchFollows: params.followArr } }, function (err, doc, res) { });
    message.channel.send(`Succesfully linked ${streamer.displayName} to your account, you now have ${params.followArr.length} channels you are following!`);
    return -1;
}
exports.linkTwitch = linkTwitch;

async function linkChannelWithTwitch(message, params, user) {

    if (!message.member.permissions.has("ADMINISTRATOR"))
        return message.channel.send("You do not have the required permissions to set the default prefix for the server");

    if (!message.mentions.channels.length != 1) return message.channel.send("You have to mention a channel to put the twitch notifications in!");

    let args = message.content.split(" ").slice(1);

    if (args.length != 2) return message.channel.send("You did not specify a proper twitch streamer/text channel combo!");

    let streamer;
    try {
        streamer = await getTwitchChannel(args[0]);
    }
    catch{

    }
    if (!streamer) return message.channel.send("I could not find a channel with that name, try again?");

    let guild = await MAIN.findGuild({ id: message.guild.id });
    console.log(guild)

    //message.channel.send(`Trying to link 

    if (!guild.channelTwitch) guild.channelTwitch = [];

    for (channel of guild.channelTwitch) {
        if (channel[1] == message.channel.id)
            if (channel[0] == streamer._data.id)
                return message.channel.send(`${streamer._data.display_name}'s live stream notifications are already posted in ${message.mentions.channels.first()}!`);
    }


    guild.channelTwitch.push([streamer._data.id, message.channel.id])
    console.log(guild.id)
    Guild.findOneAndUpdate({ id: guild.id }, { $set: { channelTwitch: guild.channelTwitch } }, function (err, doc, res) { if (err) console.log(err) });
    message.channel.send(`Succesfully linked ${streamer._data.display_name} to ${message.mentions.channels.first()}`);
    return -1;
}
exports.linkChannelWithTwitch = linkChannelWithTwitch;

async function shakeUser(message, params, user) {

    if (message.channel.type == 'dm') return message.channel.send("You must be in a server voice channel and send the command from a server!");
    if (message.mentions.members.size != 1) return message.channel.send("You must mention only/at least one user!");

    let targetMember = message.mentions.members.first();
    if (targetMember.id == MAIN.botID) return message.channel.send("I'm not going to shake myself!");
    if (!message.member.permissions.has("ADMINISTRATOR"))
        if (message.member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0)
            return message.channel.send("You can't shake a user with a higher role than yours (unless you're an admin)!");

    let startingChannel = targetMember.voice.channel;
    if (!startingChannel) return message.channel.send("The user needs to be in this server's voice channel!");


    let voiceChannels = message.guild.channels.cache.filter(channel => channel.type == 'voice').filter(channel => channel.permissionsFor(targetMember).has('CONNECT')).array();
    voiceChannels = voiceChannels.filter(channel => !channel.full);

    let backUpVoiceChannels = [];

    for (channel of voiceChannels) {
        if (channel.members.size != 0)
            backUpVoiceChannels.push(channel);
    }

    voiceChannels = voiceChannels.filter(channel => channel.members.size == 0);

    if ((voiceChannels.size == 0) && (backUpVoiceChannels.length == 0)) return message.channel.send("There are no other possible channels to move the user to!");

    if (voiceChannels.size == 0)
        voiceChannels = backUpVoiceChannels;

    if (voiceChannels.length == 1) return message.channel.send(`There are no other voice channels that ${targetMember.displayName} can be moved to!`);

    let args = params.custom ? params.url : message.content.split(" ").slice(1).join(" ");

    while (args.includes('<')) {
        args = args.substring(0, args.indexOf('<')) + args.substring(args.indexOf('>') + 1);
    }

    args = Math.floor(Number(args));

    if ((args <= 0) || (args > 20)) return message.channel.send("You can shake a user a max of 20 times, and at least once!");

    let previousChannel = startingChannel;
    let newChannel = startingChannel;

    for (let i = 0; i < args; i++) {

        while (previousChannel == newChannel) {

            newChannel = voiceChannels[Math.floor(Math.random() * args)];
        }

        targetMember.voice.setChannel(newChannel);
        previousChannel = newChannel;
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    targetMember.voice.setChannel(startingChannel);
}
exports.shakeUser = shakeUser;

async function populate(message, params) {
    for (i = 1; i <= params[0]; i++) {

        await message.channel.send(i).then(sent => {

            reactAnswers(sent);
        });
    }
    message.delete();
}
exports.populate = populate;

async function searchForUser(message, params, user) {

    const args = message.content.split(" ").slice(1).join(" ");
    if (!args && (message.mentions.members.size < 1)) return message.reply("You need to provide the name/mention a user to search for!");

    if (message.mentions.members.size > 0) {

        let goal = message.mentions.members.values().next().value.id;

        for (guild of MAIN.Client.guilds.cache.values()) {
            for (channel of guild.channels.cache.values()) {
                if (channel.type == "voice") {
                    if (channel.members.size > 0)
                        for (member of channel.members.values()) {
                            if (member.id == goal)
                                return message.channel.send("```diff\n" + `${member.displayName} was found in:\n+Server: ${guild.name}\n-Channel: ${channel.name}` + "```");
                        }
                }
            }
        }
    }
    else {
        for (guild of MAIN.Client.guilds.cache.values()) {
            for (channel of guild.channels.cache.values()) {
                if (channel.type == "voice") {
                    if (channel.members.size > 0)
                        for (member of channel.members.values()) {
                            if (member.displayName == args)
                                return message.channel.send("```diff\n" + `${member.displayName} was found in:\n+Server: ${guild.name}\n-Channel: ${channel.name}` + "```");
                        }
                }
            }
        }
    }
    return message.channel.send("I didn't find the user in any of my servers!");
}
exports.searchForUser = searchForUser;

async function flipCoin(message, params, user) {

    if (!params.step) {
        let messa = await message.channel.send("Flipping coin...");
        return setTimeout(flipCoin, 750, messa, { step: 1 }, user);
    }

    switch (params.step) {

        case 1:
            message.edit(message.content + "\n\\");
            break;
        case 2:
            message.edit(message.content + "\n |");
            break;
        case 3:
            message.edit(message.content + "\n/");
            break;
        case 4:
            message.edit(message.content + "\n__");
            break;
        case 5:

            let coin = Math.floor(Math.random() * 2) == 0 ? "Tails!" : "Heads!";
            message.edit(message.content + `\n${coin}`);
            break;
    }

    params.step++;
    if (params.step != 6)
        setTimeout(flipCoin, 750, message, { step: params.step }, user);
}
exports.flipCoin = flipCoin;

async function roll(message, params, user) {

    const args = message.content.split(" ").slice(1).join(" ");
    if (isNaN(args) || (args.length < 1)) return message.channel.send("You need to enter a number.");
    if (Number.MAX_SAFE_INTEGER < Number(args)) return message.channel.send("That number is too large.");

    if (args)
        return message.channel.send(`${user.displayName} rolled a ${Math.floor((Math.random() * args) + 1)}`);
    return message.channel.send(`${user.displayName} rolled a ${Math.floor((Math.random() * 20) + 1)}`);
}
exports.roll = roll;

function study(message, query) {

    if (query == undefined || query == null || query.length < 1) {

        message.channel.send("You didn't provide a search criteria, try again - i.e. " + prefix + "gamesList counter");
        return -1;
    }

    let finalObject = new Array();

    for (let i = 0; i < studyArray.length; i++) {

        let ppt = studyArray[i];

        for (let j = 0; j < ppt.slides.length; j++) {

            let slide = ppt.slides[j];
            let tempObject = {
                items: [],
                refIndex: [],
                originalString: "",
                deckName: ppt.pptName
            }
            let index = finalObject.length;

            let slideArray = slide.split(" ");

            let options1 = {
                isCaseSensitive: false,
                findAllMatches: true,
                includeMatches: false,
                includeScore: true,
                useExtendedSearch: false,
                minMatchCharLength: query[0].length / 2,
                shouldSort: true,
                threshold: 0.125,
                location: 0,
                distance: 100,
                keys: [
                    "slides"
                ]
            };

            let fuse = new Fuse(slideArray, options1);
            let searchWords = query[0].split(" ");

            for (let k = 0; k < searchWords.length; k++) {

                let searchWord = searchWords[k];
                let result = fuse.search(searchWord);
                for (let l = 0; l < result.length; l++) {
                    let found = result[l];


                    if (finalObject[index] == undefined) {
                        finalObject.push(tempObject);
                        let itemString = found.item.charAt(0).toLowerCase() + found.item.slice(1);
                        itemString = itemString.replace(/[\r\n,.(){}:;`~!@#$%^&*-_=+|]+/g, " ").trim();
                        finalObject[index].items.push(itemString);
                        finalObject[index].refIndex.push(found.refIndex);
                        finalObject[index].originalString = slide;
                    }
                    else if (!finalObject[index].refIndex.includes(found.refIndex)) {

                        let itemString = found.item.charAt(0).toLowerCase() + found.item.slice(1);
                        itemString = itemString.replace(/[\r\n,.(){}:;`~!@#$%^&*-_=+|]+/g, " ").trim();
                        finalObject[index].items.push(itemString);
                        finalObject[index].refIndex.push(found.refIndex);
                    }
                }//result loop
            }//searchWords loops
        }//slide loop
    }//ppt loop

    let currentSlideDeck = "";

    let searchNumbers = finalObject.length;
    if (query[1] != null)
        if (Number(query[1]) > 0 && Number(query[1]) < searchNumbers)
            searchNumbers = Number(query[1]);

    let minResults = -1;
    if (query[2] != null)
        minResults = query[2];

    let minUniqueResults = -1;
    if (query[3] != null) {

        minUniqueResults = query[3];
    };

    if (finalObject.length > 0) {

        finalObject.sort(function (a, b) { return b.items.length - a.items.length });

        for (let i = 0; i < searchNumbers; i++) {

            let uniqueItems = new Array();

            if (minUniqueResults != -1) {

                let setty = new Set(finalObject[i].items);
                uniqueItems = Array.from(setty);
            }

            if (minResults <= finalObject[i].items.length && minUniqueResults <= uniqueItems.length) {

                let tempy = finalObject[i].originalString.split(" ");

                if (currentSlideDeck != finalObject[i].deckName) {

                    message.channel.send("```Here the search results from slide deck: " + finalObject[i].deckName + "```\n");
                    currentSlideDeck = finalObject[i].deckName;
                }

                for (let j = 0; j < finalObject[i].items.length; j++) {
                    tempy[finalObject[i].refIndex[j]] = "__**" + tempy[finalObject[i].refIndex[j]] + "**__"
                }

                tempy = tempy.join(" ");
                message.channel.send(tempy)
                message.channel.send("===========================================");
            }
        }
        message.channel.send("```DONE!```");
    }
    else {
        message.channel.send("```Did not find any matches!```");
    }
}
exports.study = study;

async function decider(message, params, user) {

    const args = message.content.split(" ").slice(1).join(" ").split(",");

    if (!args) return message.channel.send("You have to provide at least 1 option!");
    return message.channel.send(`I have chosen: ${args[Math.floor(Math.random() * args.length)]}`)
}
exports.decider = decider;

async function checkGuildTwitchStreams(guilds) {

    for (guild of guilds) {
        for (channel of guild.channelTwitch) {

            let streamer = await getTwitchChannelByID(channel[0])
            let stream = await streamer.getStream();

            if (stream) {

                let streamDate = new Date(stream._data.started_at);
                let found = false;
                let index = -1;

                if (!guild.twitchNotifications) guild.twitchNotifications = [];

                for (let i = 0; i < guild.twitchNotifications.length; i++) {
                    if (guild.twitchNotifications[i][0] == stream._data.user_id) {
                        index = i;

                        let previousTime = new Date(guild.twitchNotifications[i][1]);
                        if ((previousTime - streamDate) == 0)
                            found = true;
                        break;
                    }
                }
                if (!found) {

                    if (index != -1)
                        guild.twitchNotifications[index] = [stream._data.user_id, stream._data.started_at];
                    else
                        guild.twitchNotifications.push([stream._data.user_id, stream._data.started_at]);

                    Guild.findOneAndUpdate({ id: guild.id }, { $set: { twitchNotifications: guild.twitchNotifications } }, function (err, doc, res) { if (err) console.log(err) });

                    let messageSent = false;

                    for (let guild of MAIN.Client.guilds.cache) {

                        for (channy of guild[1].channels.cache) {
                            if (channy[1].id == channel[1]) {
                                const permission = channy[1].permissionsFor(MAIN.Client.user);
                                if (permission.has('SEND_MESSAGES')) {
                                    channy[1].send(`${stream._data.user_name} is live at: https://www.twitch.tv/${stream._data.user_name}`);
                                    messageSent = true;
                                    break;
                                }
                            }
                        }
                        if (messageSent) break;
                    }
                }
            }
        }
    }
}
exports.checkGuildTwitchStreams = checkGuildTwitchStreams;

async function checkUsersTwitchStreams(users) {

    for (USER of users) {
        for (channel of USER.twitchFollows) {

            let streamer = await getTwitchChannelByID(channel)
            let stream = await streamer.getStream();

            if (stream) {

                console.log("IM AT: " + USER.displayName)
                let streamDate = new Date(stream._data.started_at);
                let found = false;
                let index = -1;

                if (!USER.twitchNotifications) USER.twitchNotifications = [];

                for (let i = 0; i < USER.twitchNotifications.length; i++) {
                    if (USER.twitchNotifications[i][0] == stream._data.user_id) {
                        index = i;

                        let previousTime = new Date(USER.twitchNotifications[i][1]);
                        if ((previousTime - streamDate) == 0)
                            found = true;
                        break;
                    }
                }
                if (!found) {

                    if (index != -1)
                        USER.twitchNotifications[index] = [stream._data.user_id, stream._data.started_at];
                    else
                        USER.twitchNotifications.push([stream._data.user_id, stream._data.started_at]);

                    User.findOneAndUpdate({ id: USER.id }, { $set: { twitchNotifications: USER.twitchNotifications } }, function (err, doc, res) { if (err) console.log(err) });

                    //console.log(MAIN.Client.guilds.cache)

                    for (let guild of MAIN.Client.guilds.cache) {
                        let messageSent = false;

                        //                                            console.log(guild[1].name)
                        for (member of guild[1].members.cache) {
                            console.log(member[1].displayName, " ::: ", USER.displayName)
                            if (member[1].user.id == USER.id) {
                                console.log("WWWWTF")
                                member[1].user.send(`${stream._data.user_name} is live at: https://www.twitch.tv/${stream._data.user_name}`);
                                messageSent = true;
                                break;
                            }
                        }
                        if (messageSent) break;
                    }
                }
            }
        }
    }
}
exports.checkUsersTwitchStreams = checkUsersTwitchStreams;


async function reactAnswers(message) {

    await message.react("🇦");
    await message.react("🇧");
    await message.react("🇨");
    await message.react("🇩");
    await message.react("🇪");
    await message.react("🇫");
}