/**
 * @Description:
 * @Author: fuwensong
 * @Date: 2015/5/23
 */
var RestMVC = require('rest-mvc');
var _ = require('underscore');
var async = require('async');
var localStorage = RestMVC.plugin('storage').localStorage;

var IndexPageView = require('../views/index-page');
var ChatGroupModel = require('../models/chat-group');
var ChatGroupMemberModel = require('../models/chat-group-member');
var ChatMessageCollection = require('../collections/chat-message');
var ChatMessageModel = require('../models/chat-message');

module.exports = {
  index: function () {
    var user = this.user;
    var groupId = user.groupId;
    var userId = user.id;
    var indexPageView = new IndexPageView();
    var chatMessageCollection = new ChatMessageCollection();
    var charGroupModel = new ChatGroupModel({id: groupId});
    var chatGroupMemberModel = new ChatGroupMemberModel({groupId: groupId, userId: userId});

    async.parallel([
      function loadGroupData(callback) {
        charGroupModel.url = charGroupModel.idUrl();
        charGroupModel.fetch(function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, this);
        });
      },
      function loadMessages(callback) {
        chatMessageCollection.groupId = groupId;
        chatMessageCollection.comparator = chatMessageCollection.idDESC;
        chatMessageCollection.url = chatMessageCollection.groupPublicRecordUrl();
        chatMessageCollection.fetch(function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, this);
        });
      },
      function loadGroupMemberData(callback) {
        chatGroupMemberModel.url = chatGroupMemberModel.userGroupUrl();
        chatGroupMemberModel.fetch(function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, this);
        });
      }
    ], function (err, results) {
      if (err) {
        return indexPageView.error(err);
      }
      localStorage.setJSON(RestMVC.Settings.locals.userGroupInfo, results[0].toJSON());

      user.memberInfo = results[2].attributes;
      indexPageView.render(results);
    })

    this.socket.on('member joined', function (user) {
      indexPageView.trigger('memberJoined', user);
    });
    this.socket.on('msg revoked', function (msgId) {
      indexPageView.trigger('msgRevoked', msgId);
    });
    return indexPageView;
  },
  private: function (id) {

  },
  sendMsg: function (msg, callback) {
    if (!msg || !_.isObject(msg)) return console.error('sendMessage msg is invalid.');

    var socket = this.socket;
    var messageModel = new ChatMessageModel(msg);

    if (!messageModel.isValid()) {
      return callback(messageModel.validationError);
    }

    if (msg.messageType === RestMVC.Settings.messageTypes.public) {
      socket.emit('public msg', msg, callback);
    } else if (msg.messageType === RestMVC.Settings.messageTypes.private) {
      socket.emit('private msg', msg, callback);
    }
  },
  revokeMsg: function (id, callback) {
    if (!id) return console.error('revokeMsg msg id is invalid.');

    this.socket.emit('revoke msg', {
      msgId: id,
      userId: this.user.id
    }, callback);
  },
  loadMoreMsgs: function (data, callback) {
    if (!data || !_.isObject(data)) return console.error('loadMoreMsgs data is invalid.');

    var sinceId = data.sinceId;
    var toId = data.toId;
    var toUserId = data.toUserId;
    var fromId = this.user.memberInfo.id;
    var fromUserId = this.user.id;
    var chatMessageCollection = new ChatMessageCollection();

    chatMessageCollection.comparator = chatMessageCollection.idAsc;
    chatMessageCollection.groupId = this.user.groupId;

    if (toId && toUserId) {
      chatMessageCollection.url = chatMessageCollection.groupPrivateRecordUrl(sinceId, fromId, toId);
    } else {
      chatMessageCollection.url = chatMessageCollection.groupPublicRecordUrl(sinceId);
    }

    chatMessageCollection.fetch(function (err) {
      if (err) {
        return callback(err);
      }
      callback(null, this);
    });
  }
};
