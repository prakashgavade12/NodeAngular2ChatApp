/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
'use strict';

var express = require('express');
var router = express.Router();
var request = require('request');


var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var bot_config = require("../bot-config.json");




// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: '6c754e1e-0321-4783-a35d-811c674505a0',
  password: 'ldUcnfk2igaD',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2017-05-04',
  version: 'v1'
});

// Endpoint to be call from the client side
router.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };
  console.log("------------payload ", payload);
  
  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
	console.log("---err ", err);
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

router.get('/callback', function(req, res, next){
	console.log(" <<<<<<<<<< Get Callback >>>>>>>>>>>>>>>>");
	if (req.query['hub.verify_token'] === bot_config.fb_verify_token) {
      res.send(req.query['hub.challenge']);
    } else {
      res.send('Error, wrong validation token');    
	}
});

router.post('/callback', function(req, res, next){
	console.log(" <<<<<<<<<< Post Callback >>>>>>>>>>>>>>>>");
    console.log("req header: " + req.header);
    console.log("req body: "+ req.body);
    
    var messaging_events = req.body.entry[0].messaging;
    console.log("req messaging_events: "+ messaging_events);
    
	  for (var i = 0; i < messaging_events.length; i++) {
		var event = req.body.entry[0].messaging[i];
		var sender = event.sender.id;

		if (event.message && event.message.text) {
		  var text = event.message.text;
		  processQuestion(sender, text);
		  
		}
	  }
	  res.sendStatus(200);
});

function sendTextMessage(sender, text) {
    var messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:bot_config.fb_access_token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

// ----------------------------------------------------
function processQuestion(sender, text) {
	var messageData = {};
	messageData.text = text;
	
	console.log('processQuestion, sender = ' + sender + ', text = ' + text);
	
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	console.log("-------------workspace ", workspace);
	
	  if (!workspace || workspace === '<workspace-id>') {
		console.log('The app has not been configured with a <b>WORKSPACE_ID</b> environment variable.');
		/*return res.json({
		  'output': {
			'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
		  }
		});*/
	  }
	  
	 var payload = {
		workspace_id: workspace,
		context: {},
		input: messageData || {}
	  };
	
	  console.log("------------payload.input ", payload.input);
	  
	  // Send the input to the conversation service
	  conversation.message(payload, function(err, data) {
		if (err) {
			console.error('processQuestion, Error sending message to conversation: ', err);
		  //return res.status(err.code || 500).json(err);
		}
		console.log(" get data from conversation ");
		var msg = {};
		msg.text = "I'm sorry but I didn't understand the question";
		if(data && data.output && data.output.text && data.output.text.length > 0){
			msg.text = data.output.text[0]
		}
		sendTextResponseToSender(sender, msg, function(err, data) {
			console.log(" data from conv ", data);
			if (err) {
			  console.error('processQuestion, Error sending response: ', err);
			} else {
			  console.log('processQuestion, Response sent successfully');
			}
		});
		//return res.json(updateMessage(payload, data));
	  });
	  
	//response = { "text" : "Hi, How i can help you?" };
	/*sendTextResponseToSender(sender, response, function(err, data) {
        if (err) {
          console.error('processQuestion, Error sending response: ', error);
        } else {
          console.log('processQuestion, Response sent successfully');
        }
    });*/
  
}

function sendTextResponseToSender(sender, msg, callback) {
  console.log('sendTextResponseToSender, sending response to messenger = ' + JSON.stringify(msg.text));

  var resp_arr = [];
  resp_arr.push(msg.text);

  console.log('sendTextResponseToSender, resp_arr = ' + JSON.stringify(resp_arr));

  if (resp_arr.length > 0) {
    for (var i = 0; i < resp_arr.length; i++) {
      request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: bot_config.fb_access_token},
        method: 'POST',
        json: {
          recipient: {id: sender},
          message: {'text': resp_arr[i]}
        }
      }, function (error, response, body) {
        if (error) {
          callback(error, null);
        } else if (response.body.error) {
          callback(error, null);
        } else {
          callback(null, body);
        }
      });
    }
  }
}

//-----------------------------------------------------------

// Endpoint to be call from the client side
router.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

module.exports = router;

