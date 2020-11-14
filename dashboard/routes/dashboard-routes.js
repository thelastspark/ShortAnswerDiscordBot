const express = require('express');
const router = express.Router();
const MAIN = require('../../scraper.js');
const {
    validateGuild
} = require('../modules/middleware.js');
const GUILDS = require('../../Guild.js');

router.get('/dashboard', function (req, res) {
    res.render('dashboard/index', {
        something: "Null",
        subtitle: "Short Answer Bot Dasboard"
    });
    //res.send('Hello World')
});

router.get('/servers/:id', validateGuild, async function (req, res) {


    res.locals.guildPrefix = res.locals.guildPrefix == '-1' ? 'sa!' : res.locals.guildPrefix;
    res.locals.userPrefix = res.locals.userPrefix == '-1' ? 'sa!' : res.locals.userPrefix;


    let roleArr = [];

    for (let role of res.locals.guild.roles.cache.values())
        roleArr.push({roleID: role.id, name: role.name});

    console.log()

    res.render('dashboard/show', {
        something: "Null",
        subtitle: "Short Answer Bot Dashboard",
        url: MAIN.REDIRECT_URL,
        key: res.cookies.get('key'),
        guild: res.locals.guild,
        roles: roleArr,
        dbGuild: res.locals.dbGuild,
        admin: res.locals.admin,
        guildPrefix: res.locals.guildPrefix,
        userPrefix: res.locals.userPrefix,
        dbUser: res.locals.dbUser
    });
    //res.send('Hello World')
});

router.put('/servers/:id/:module', validateGuild, async function (req, res) {

    try {

        const {
            id,
            module
        } = req.params;


        console.log(`DIS BE: ${id}`)
        console.log(`ThOOOO: ${module}`)

        //const savedGuild = await guilds.get

        res.redirect(`/servers/${id}`)

    } catch (err) {

        res.render('errors/400');
    }

});


module.exports = router;