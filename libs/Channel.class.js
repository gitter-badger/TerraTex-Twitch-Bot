/**
 * Created by Colin on 26.12.2015.
 */
"use strict";

class Channel {
    /**
     * Creates a Bot for a new Channel
     */
    constructor(channelName, client, botName, connectMessage) {

        if (connectMessage === null || typeof connectMessage === "undefined") {
            connectMessage = 1;
        }

        botName = botName.toLowerCase();

        this._firstJoin = true;

        this._channelName = channelName;
        this._client = client;
        this._botName = botName;
        this._lastQuoteTimer = null;

        client.on("ping", function () {
            client.raw("PONG");
        });
        client.on("join", (function (channel, username) {
            if (username === botName && this._firstJoin) {
                if (connectMessage) {
                    client.say("#" + channel, "Ich bin ein Bot und ich bin in Entwicklung. Es dauert noch bis ich etwas tun kann.");
                }
                this._firstJoin = false;
            }
            if (this._settings.chatNotifications) {
                this.checkChatJoinAlert(username);
            }
        }).bind(this));
        client.on("part", (function (channel, username) {
            if (username !== botName) {
                if (this._settings.chatNotifications) {
                    this.checkChatLeft(username);
                }
            }
        }).bind(this));

        this._lastFollowerCheck = new Date();

        // getChannelID
        this._settings = {};
        this._ID = null;
        this._partnered = false;
        this._streamStatus = false;
        this._streamInfo = {};
        this._lastStreamStart = null;
        this._lastStreamDisconnect = null;

        this._joinedChatUsers = {};
        this._offlineChatUsers = {};

        g_database.getTable("channel", {channelName: channelName}, (function (err, result) {
            this._ID = result[0].ID;
            this._partnered = result[0].partnered !== 0;
            this.loadSettings();

            //Timer for getting Stream status
            setTimeout(this.getStreamStatus.bind(this), 5000);

            // Include additional Systems
            this._systems = {};
            let commandHandler = require("./channelsystems/CommandHandler.js");
            this._systems.commandHandler = new commandHandler(this);

            let quoteSystem = require("./channelsystems/QuoteSystem.js");
            this._systems.quoteSystem = new quoteSystem(this);

            let pointsSystem = require("./channelsystems/PointsSystem.js");
            this._systems.pointsSystem = new pointsSystem(this);

            let viewerSystem = require("./channelsystems/ViewerSystem.js");
            this._systems.viewerSystem = new viewerSystem(this);

            let textSystem = require("./channelsystems/TextHandler.js");
            this._systems.textHandler = new textSystem(this);

            let ViewerRankSystem = require("./channelsystems/ViewerRankSystem.js");
            this._systems.ViewerRankSystem = new ViewerRankSystem(this);

            let GiveAwaySystem = require("./channelsystems/GiveAwaySystem.js");
            this._systems.GiveAwaySystem = new GiveAwaySystem(this);

            let ChatGames = require("./channelsystems/ChatGames.js");
            this._systems.ChatGames = new ChatGames(this);

            let ChatFilter = require("./channelsystems/ChatFilter.js");
            this._systems.ChatFilter = new ChatFilter(this);

            let ScriptedCommands = require("./channelsystems/ScriptedCommands.js");
            this._systems.ScriptedCommands = new ScriptedCommands(this);

            let Timer = require("./channelsystems/Timer.js");
            this._systems.Timer = new Timer(this);



            //for stats
            this._lastTotal = 0;

            //getLastReadedTotal
            let query = "SELECT value FROM stats_follows WHERE channelID = :channelID ORDER BY time desc LIMIT 0,1";
            g_database.query(query, {channelID: result[0].ID}, (function (statErr, valued) {
                if (!statErr) {
                    if (valued.length > 0) {
                        this._lastTotal = valued[0].value;
                    }
                }
            }).bind(this));
        }).bind(this));
        
    }

    getStreamStatus() {
        setTimeout(this.getStreamStatus.bind(this), 5000);

        g_twitchAPI.getChannelStream(this._channelName, (function (err, result) {
            if (!err && result) {
                if (result.stream) {
                    if (!this._streamStatus) {
                        this._lastStreamStart = new Date();
                    }
                    this._streamStatus = true;
                    this._lastStreamDisconnect = null;
                    this._streamInfo = result;

                    //stats
                    g_database.insert("stats_viewer", {
                        channelID: this._ID,
                        viewer: result.stream.viewers
                    });

                } else {
                    let offlineDate = new Date(new Date().getTime() - 1000 * 60 * 10);

                    if (this._lastStreamDisconnect > offlineDate && this._streamStatus) {
                        this._streamStatus = false;
                        this._lastStreamDisconnect = new Date();
                    }
                    if (!this._lastStreamDisconnect && this._streamStatus) {
                        this._lastStreamDisconnect = new Date();
                    }
                    g_database.insert("stats_viewer", {
                        channelID: this._ID,
                        viewer: 0
                    });
                }

            }
        }).bind(this));

    }

    /** SETTINGS FUNCTIONS **/

    loadSettings() {
        this.loadChatNotifications();
    }

    loadChatNotifications() {
        let sql = "SELECT * FROM chat_notifications WHERE channelID = :ID;";
        g_database.query(sql, {"ID": this._ID}, (function (err, result) {
            if (!err) {
                if (result.length === 0) {
                    g_database.insert("chat_notifications", {channelID: this._ID}, (function () {
                        this.loadChatNotifications();
                    }).bind(this));
                } else {
                    this._settings.chatNotifications = result[0];
                    if (this._settings.chatNotifications.followerAlert === 1) {
                        setTimeout(this.checkNewFollow.bind(this), 2500);
                    }
                }
            }
        }).bind(this));
    }

    /** BOT FUNCTIONS **/
    checkNewFollow() {
            g_twitchAPI.getChannelFollows(this._channelName, {
                limit: "25",
                direction: "desc"
            }, (function (err, result) {
                if (!err && result.follows) {
                    if (this._settings.chatNotifications.followerAlert === 1) {
                        let length = result.follows.length;

                        let follow, followDate;
                        let newFollowerDate = this._lastFollowerCheck;
                        for (let i = 0; i < length; i++) {
                            follow = result.follows[i];
                            followDate = new Date(follow.created_at);
                            if (this._lastFollowerCheck > followDate) {
                                break;
                            } else {
                                this._client.say(this._channelName, this.text.get("notifications.new_follower", {
                                    user: follow.user.display_name
                                }));
                                newFollowerDate = new Date();
                            }
                        }

                        this._lastFollowerCheck = newFollowerDate;
                    } else {
                        this._lastFollowerCheck = new Date();
                    }

                    //save statistics
                    let newTotal = result._total;
                    let diff = newTotal - this._lastTotal;

                    g_database.insert("stats_follows", {
                        channelID: this._ID,
                        value: newTotal,
                        diff: diff
                    });

                    this._lastTotal = newTotal;
                }
                setTimeout(this.checkNewFollow.bind(this), 61000);
            }).bind(this));

    }

    checkChatLeft(username) {
        if (this._settings.chatNotifications.chatJoinAlert === 1 && this._streamStatus) {
            this._offlineChatUsers[username] = new Date();
        }
    }

    checkChatJoinAlert(username) {

        if (this._settings.chatNotifications.chatJoinAlert === 1 && this._streamStatus) {
            let actualTime = new Date();

            let twitchBotList = g_configs.twitch.defaultBotNames;
            if (username !== this._channelName && username !== this._botName && twitchBotList.indexOf(username) === -1) {
                let sendMessage = false;
                if (!this._joinedChatUsers[username]) {
                    sendMessage = "new_chatter";
                } else if (this._offlineChatUsers[username]) {
                    let offDate = this._offlineChatUsers[username];

                    if (offDate.getTime() > actualTime.getTime() - (15 * 60000)) {
                        sendMessage = "back_chatter";
                    }
                }

                if (sendMessage) {
                    let message = this.text.get("notifications." + sendMessage, {
                        user: username
                    });

                    this._joinedChatUsers[username] = actualTime;
                    this._offlineChatUsers[username] = false;


                    if (this._settings.chatNotifications.chatJoinTarget.toLowerCase() === "chat") {
                        this._client.say(this._channelName, message);
                    } else if (this._settings.chatNotifications.chatJoinTarget.toLowerCase() === "streamer") {
                        this._client.whisper(this._channelName.replace("#", ''), message);
                    }
                }
            }
        } else {
            this._joinedChatUsers = {};
            this._offlineChatUsers = {};
        }
    }

    /** getter **/
    get text() {
        return this._systems.textHandler;
    }

    /**
     * @returns {CommandHandler}
     */
    get command() {
        return this._systems.commandHandler;
    }

    /**
     * @returns {QuoteSystem}
     */
    get quote() {
        return this._systems.quoteSystem;
    }

    /**
     * @returns {ViewerSystem}
     */
    get viewerSystem() {
        return this._systems.viewerSystem;
    }

    /**
     * @returns {PointsSystem}
     */
    get pointsSystem() {
        return this._systems.pointsSystem;
    }

    /**
     * @returns {ViewerRankSystem}
     */
    get rankSystem() {
        return this._systems.ViewerRankSystem;
    }

    /**
     * @returns {GiveAwaySystem}
     */
    get giveaway() {
        return this._systems.GiveAwaySystem;
    }

    /**
     * @returns {ChatGames}
     */
    get chatGames() {
        return this._systems.ChatGames;
    }

    /**
     * @returns {ChatFilter}
     */
    get chatFilter() {
        return this._systems.ChatFilter;
    }

    /**
     * @returns {ScriptedCommands}
     */
    get scriptedCommands() {
        return this._systems.ScriptedCommands;
    }

    /**
     * @returns {Timer}
     */
    get timer() {
        return this._systems.Timer;
    }
}
module.exports = Channel;