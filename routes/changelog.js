/**
 * Created by geramy on 10.01.2016.
 */
"use strict";

var express = require('express');
var router = express.Router();
var version = require('./../package.json').version;

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index.hbs', {content: 'changelog', version: (version + "-BUILD." + g_build)});
});

module.exports = router;