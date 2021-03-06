// Page loaded
//added comment
$(function() {

// ** Application container ** //
window.SP = {}

// Global state
SP.state = {};
SP.state.callNumber = null;
SP.state.calltype = "";
SP.username = $('#client_name').text();
SP.currentCall = null;  //instance variable for tracking current connection
SP.requestedHold = false; //set if agent requested hold button
var softphoneWindow; //It holds the softphoneWindow Reference

SP.functions = {};

// Get a Twilio Client name and register with Twilio
SP.functions.getTwilioClientName = function(sfdcResponse) {
sforce.interaction.runApex('UserInfo', 'getUserName', '' , SP.functions.registerTwilioClient);
} 



SP.functions.registerTwilioClient = function(response) {

console.log("Registering with client name: " + response.result);

// Twilio does not accept special characters in Client names
var useresult = response.result;
useresult = useresult.replace("@", "AT");
useresult = useresult.replace(".", "DOT");
SP.username = useresult;
console.log("useresult = " + useresult);

$.get("/token", {"client":SP.username}, function (token) {
Twilio.Device.setup(token, {debug: true});
});

$.get("/getcallerid", { "from":SP.username}, function(data) {
$("#callerid-entry > input").val(data);
});

SP.functions.startWebSocket();


}


SP.functions.startWebSocket = function() {
// ** Agent Presence Stuff ** //
console.log(".startWebSocket...");
var wsaddress = 'wss://' + window.location.host  + "/websocket?clientname=" + SP.username

var ws = new WebSocket(wsaddress);

ws.onopen    = function()  { 
console.log('websocket opened');
};
ws.onclose   = function()  { console.log('websocket closed'); }
ws.onmessage = function(m) { 
console.log('websocket message: ' +  m.data);

var result = JSON.parse(m.data);

$("#team-status .queues-num").text(result.queuesize);
$("#team-status .agents-num").text(result.readyagents); 
};

}

// ** UI Widgets ** //

// Hook up numpad to input field
$("div.number").bind('click',function(){
//$("#number-entry > input").val($("#number-entry > input").val()+$(this).attr('Value'));
//pass key without conn to a function
SP.functions.handleKeyEntry($(this).attr('Value'));  

});

SP.functions.handleKeyEntry = function (key) {  
if (SP.currentCall != null) {
console.log("sending DTMF" + key);
SP.currentCall.sendDigits(key);
} else {
$("#number-entry > input").val($("#number-entry > input").val()+key);
}

}

//called when agent is not on a call
SP.functions.setIdleState = function() {
$("#action-buttons > .call").show();
$("#action-buttons > .answer").hide();
$("#action-buttons > .mute").hide();
$("#action-buttons > .hold").hide();
$("#action-buttons > .unhold").hide();
$("#action-buttons > .hangup").hide();
$("#action-buttons > .voicemail").hide();
$('div.agent-status').hide();
$("#number-entry > input").val("");
}

SP.functions.setRingState = function () {
$("#action-buttons > .answer").show();
$("#action-buttons > .call").hide();
$("#action-buttons > .mute").hide();
$("#action-buttons > .hold").hide();
$("#action-buttons > .unhold").hide();
$("#action-buttons > .hangup").hide();
$("#action-buttons > .voicemail").hide();
}

SP.functions.setOnCallState = function() {

$("#action-buttons > .answer").hide();
$("#action-buttons > .call").hide();
$("#action-buttons > .mute").show();
$("#action-buttons > .voicemail").show();

//can not hold outbound calls, so disable this
if (SP.calltype == "Inbound") {
$("#action-buttons > .hold").show();
}

$("#action-buttons > .hangup").show();
$('div.agent-status').show();
}

// Hide caller info
SP.functions.hideCallData = function() {
$("#call-data").hide();
}
SP.functions.hideCallData();
SP.functions.setIdleState();

// Show caller info
SP.functions.showCallData = function(callData) {
$("#call-data > ul").hide();
$(".caller-name").text(callData.callerName);
$(".caller-number").text(callData.callerNumber);
$(".caller-queue").text(callData.callerQueue);
$(".caller-message").text(callData.callerMessage);

if (callData.callerName) {
$("#call-data > ul.name").show();
}

if (callData.callerNumber) {
$("#call-data > ul.phone_number").show();
}

if (callData.callerQueue) {
$("#call-data > ul.queue").show();
}

if (callData.callerMessage) {
$("#call-data > ul.message").show();
}

$("#call-data").slideDown(400);
}

// Attach answer button to an incoming connection object
SP.functions.attachAnswerButton = function(conn) {
$("#action-buttons > button.answer").click(function() {
conn.accept();
}).removeClass('inactive').addClass("active");
}

SP.functions.detachAnswerButton = function() {
$("#action-buttons > button.answer").unbind().removeClass('active').addClass("inactive");
}

SP.functions.attachMuteButton = function(conn) {
$("#action-buttons > button.mute").click(function() {
conn.mute();
SP.functions.attachUnMute(conn);
}).removeClass('inactive').addClass("active").text("Mute");
}

SP.functions.attachUnMute = function(conn) {
$("#action-buttons > button.mute").click(function() {
conn.unmute();
SP.functions.attachMuteButton(conn);
}).removeClass('inactive').addClass("active").text("UnMute");
}

SP.functions.detachMuteButton = function() {
$("#action-buttons > button.mute").unbind().removeClass('active').addClass("inactive");
}

SP.functions.attachHoldButton = function(conn) {
$("#action-buttons > button.hold").click(function() {
console.dir(conn);
SP.requestedHold = true;
//can't hold outbound calls from Twilio client
$.post("/request_hold", { "from":SP.username, "callsid":conn.parameters.CallSid, "calltype":SP.calltype }, function(data) {
//Todo: handle errors
//Todo: change status in future
SP.functions.attachUnHold(conn, data);

});

}).removeClass('inactive').addClass("active").text("Hold");
}
// ---- VoiceMail --------- //
SP.functions.attachVoiceMailButton = function(conn) 
{
$("#action-buttons > button.voicemail").click(function() 
{
//alert("Voicemail Functionality");
//alert("CallSID------"+conn.parameters.CallSid);
//alert("callerid------"+conn.parameters.From);
//console.log("Voicemail Functionality");
//alert("ABOUT TO POST--VOICEMAIL----");

//console.log("ABOUT TO POST--VOICEMAIL----");
$.post("/voicemail", {"callsid":conn.parameters.CallSid,"MachineDetection":"Enable","calid":$("#callerid-entry > input").val()}, function(data) 
{
alert("POST--VOICEMAIL----");
});
});
}
// ---- VoiceMail --------- //
SP.functions.attachUnHold = function(conn, holdid) {
$("#action-buttons > button.unhold").click(function() {
//do ajax request to hold for the conn.id

$.post("/request_unhold", { "from":SP.username, "callsid":holdid }, function(data) {
//Todo: handle errors
//Todo: change status in future
//SP.functions.attachHoldButton(conn);
});

}).removeClass('inactive').addClass("active").text("UnHold").show();
}

SP.functions.detachHoldButtons = function() {
$("#action-buttons > button.unhold").unbind().removeClass('active').addClass("inactive");
$("#action-buttons > button.hold").unbind().removeClass('active').addClass("inactive");
}
SP.functions.updateAgentStatusText = function(statusCategory, statusText, inboundCall) {

if (statusCategory == "ready") {
$("#agent-status-controls > button.ready").prop("disabled",true); 
$("#agent-status-controls > button.not-ready").prop("disabled",false); 
$("#agent-status").removeClass();
$("#agent-status").addClass("ready");
$('#softphone').removeClass('incoming');

}

if (statusCategory == "notReady") {
$("#agent-status-controls > button.ready").prop("disabled",false); 
$("#agent-status-controls > button.not-ready").prop("disabled",true); 
$("#agent-status").removeClass();
$("#agent-status").addClass("not-ready");
$('#softphone').removeClass('incoming');

}

if (statusCategory == "onCall") {
$("#agent-status-controls > button.ready").prop("disabled",true); 
$("#agent-status-controls > button.not-ready").prop("disabled",true); 
$("#agent-status").removeClass();
$("#agent-status").addClass("on-call");
$('#softphone').removeClass('incoming');
}

if (inboundCall ==  true) { 
//alert("call from " + statusText);
$('#softphone').addClass('incoming');
$("#number-entry > input").val(statusText);
}

//$("#agent-status > p").text(statusText);
}

// Call button will make an outbound call (click to dial) to the number entered 
$("#action-buttons > button.call").click( function() {

var callerPhoneNumber ='';
var callerCallerId ='';

if(document.getElementById('indexPagePhoneNumber') != null && document.getElementById('indexPagePhoneNumber') != undefined){
callerPhoneNumber = cleanFormatting($("#number-entry > input").val());
callerCallerId = $("#callerid-entry > input").val() == null || $("#callerid-entry > input").val() == undefined || $("#callerid-entry > input").val() == '' ? '8442012921' :  $("#callerid-entry > input").val();
$("#callerid-entry > input").val(callerCallerId);
}else{

callerPhoneNumber = cleanFormatting($("#number-entryHome > input").val());
callerCallerId = $("#callerid-entryHome > input").val();
}
params = {"PhoneNumber": callerPhoneNumber, "CallerId": callerCallerId};
Twilio.Device.connect(params);
});

// Hang up button will hang up any active calls
$("#action-buttons > button.hangup").click( function() {

$("#callerid-entry > input").val('');
$("#number-entry > input").val('');
//Call save logs method
if(document.getElementById("phoneNumberInput") != undefined && document.getElementById("phoneNumberInput") != null){

var saveLogData = {};
saveLogData['phoneNumber'] = document.getElementById("phoneNumberInput").value;
saveLogData['callerId'] = document.getElementById("callerIdInput").value;
saveLogData['objectId'] = document.getElementById("objectId").value;  
saveLog(saveLogData);

}
Twilio.Device.disconnectAll();
var elem;
if(opener != null){
var oDom = opener.document;
elem = oDom.getElementById("contactsList");
self.close();
}else{
elem = document.getElementById("contactsList");
}		
///Destroy the ContactsTable
if(elem != null && elem != undefined){
elem.innerHTML = "";
}



});

// Wire the ready / not ready buttons up to the server-side status change functions
$("#agent-status-controls > button.ready").click( function( ) {
$("#agent-status-controls > button.ready").prop("disabled",true); 
SP.functions.ready();
});

$("#agent-status-controls > button.not-ready").click( function( ) {
$("#agent-status-controls > button.not-ready").prop("disabled",true); 
SP.functions.notReady();
});

$("#agent-status-controls > button.userinfo").click( function( ) {


});



// ** Twilio Client Stuff ** //
// first register outside of sfdc


if ( window.self === window.top ) {  
console.log("Not in an iframe, assume we are using default client");
var defaultclient = {}
defaultclient.result = SP.username;
SP.functions.registerTwilioClient(defaultclient);
} else 
{
console.log("In an iframe, assume it is Salesforce");
sforce.interaction.isInConsole(SP.functions.getTwilioClientName);   
}
//this will only be called inside of salesforce




Twilio.Device.ready(function (device) {
sforce.interaction.cti.enableClickToDial();
sforce.interaction.cti.onClickToDial(startCall); 
SP.functions.ready();
});

Twilio.Device.offline(function (device) {
//make a new status call.. something like.. disconnected instead of notReady ?
sforce.interaction.cti.disableClickToDial(); 
SP.functions.notReady();
SP.functions.hideCallData();
});


/* Report any errors on the screen */
Twilio.Device.error(function (error) {
SP.functions.updateAgentStatusText("ready", error.message);
SP.functions.hideCallData();
});

/* Log a message when a call disconnects. */
Twilio.Device.disconnect(function (conn) {

//Destroying the softphone window

console.log("disconnectiong...");
$("#callerid-entry > input").val('');
$("#number-entry > input").val('');
//Call save logs method
if(document.getElementById("phoneNumberInput") != undefined && document.getElementById("phoneNumberInput") != null){

var saveLogData = {};
saveLogData['phoneNumber'] = document.getElementById("phoneNumberInput").value;
saveLogData['callerId'] = document.getElementById("callerIdInput").value;
saveLogData['objectId'] = document.getElementById("objectId").value;  
saveLog(saveLogData);

}
SP.functions.updateAgentStatusText("ready", "Call ended");
var elem;
if(opener != null){
var oDom = opener.document;
elem = oDom.getElementById("contactsList");
self.close();
}else{
elem = document.getElementById("contactsList");
}		
console.log("document.getElementById(contactsList) ===> "+elem);
///Destroy the ContactsTable
if(elem != null && elem != undefined){
elem.innerHTML = "";
}



SP.state.callNumber = null;

// deactivate answer button
SP.functions.detachAnswerButton();
SP.functions.detachMuteButton();
SP.functions.detachHoldButtons();
SP.functions.setIdleState(); 

SP.currentCall = null;

// return to waiting state
SP.functions.hideCallData();
SP.functions.ready();
//Setting caller phone and caller id to null
$("#number-entryHome > input").val(''); 
$("#callerid-entryHome > input").val('');



});

Twilio.Device.connect(function (conn) {

console.dir(conn);
var  status = "";
var callSid = conn.parameters.CallSid;
console.log("callSid------>" + callSid);
console.log("connectingforcallsid...");
// alert("cleanednumber = " + callSid);  
var callNum = null;
if (conn.parameters.From) {
callNum = conn.parameters.From;
status = "Call From: " + callNum;
SP.calltype = "Inbound";
} else {
status = "Outbound call";
SP.calltype = "Outbound";

}

console.dir(conn);


SP.functions.updateAgentStatusText("onCall", status);
SP.functions.setOnCallState();
SP.functions.detachAnswerButton();

SP.currentCall = conn;
SP.functions.attachMuteButton(conn);
SP.functions.attachHoldButton(conn, SP.calltype);
SP.functions.attachVoiceMailButton(conn);

//send status info
$.post("/track", { "from":SP.username, "status":"OnCall" }, function(data) {

});

});

/* Listen for incoming connections */
Twilio.Device.incoming(function (conn) {


// Update agent status 
sforce.interaction.setVisible(true);  //pop up CTI console
SP.functions.updateAgentStatusText("ready", ( conn.parameters.From), true);
// Enable answer button and attach to incoming call
SP.functions.attachAnswerButton(conn);
SP.functions.setRingState();

if (SP.requestedHold == true) {
//auto answer
SP.requestedHold = false;
$("#action-buttons > button.answer").click();


}



var inboundnum = cleanInboundTwilioNumber(conn.parameters.From);
var sid = conn.parameters.CallSid
var result = "";
//sfdc screenpop fields are specific to new contact screenpop
sforce.interaction.searchAndScreenPop(inboundnum, 'con10=' + inboundnum + '&con12=' + inboundnum + '&name_firstcon2=' + name,'inbound');

});

Twilio.Device.cancel(function(conn) {
console.log(conn.parameters.From); // who canceled the call
SP.functions.detachAnswerButton();
SP.functions.detachHoldButtons();
SP.functions.hideCallData();
SP.functions.notReady();
SP.functions.setIdleState();

$(".number").unbind();
SP.currentCall = null;
//SP.functions.updateStatus();
});


$("#callerid-entry > input").change( function() {
$.post("/setcallerid", { "from":SP.username, "callerid": $("#callerid-entry > input").val() });
});



// Set server-side status to ready / not-ready
SP.functions.notReady = function() {
$.post("/track", { "from":SP.username, "status":"NotReady" }, function(data) {
SP.functions.updateStatus();
});
}

SP.functions.ready = function() {

$.post("/track", { "from":SP.username, "status":"Ready" }, function(data) {
SP.functions.updateStatus();

});
}


// Check the status on the server and update the agent status dialog accordingly
SP.functions.updateStatus = function() {
$.get("/status", { "from":SP.username}, function(data) {
if (data == "NotReady" || data == "Missed") {
SP.functions.updateAgentStatusText("notReady", "Not Ready")
}

if (data == "Ready") {
SP.functions.updateAgentStatusText("ready", "Ready")
}
});

}

/******** GENERAL FUNCTIONS for SFDC  ***********************/

function cleanInboundTwilioNumber(number) {
//twilio inabound calls are passed with +1 (number). SFDC only stores 
return number.replace('+1',''); 
}

function cleanFormatting(number) { 
//changes a SFDC formatted US number, which would be 415-555-1212
if(number != undefined && number != null)
return number.replace(' ','').replace('-','').replace('(','').replace(')','').replace('+','');
return '';
}


var callerPhoneNumber ='';
var callerObjectId = '';
var callStartCall = function(response) {

sforce.interaction.setVisible(true);  //pop up CTI console
var  params = {"PhoneNumber": callerPhoneNumber, "CallerId": response.result};
console.log('Params before calling connect()'+JSON.stringify(params));
//Twilio.Device.connect(params);
var w = 200;//screen.width/2;
var h = 400;//screen.height/2;
var l = (screen.width)-(w+40);
var t = (screen.height)-(h+110);
var strWindowFeatures = "top="+t+",left="+l+",width="+w+",height="+h+",menubar=no,location=no,resizable=yes,scrollbars=no,status=no";
var url = "https://twilioctiapp.herokuapp.com/home?phoneNumber="+callerPhoneNumber+"&CallerId="+response.result+"&objId="+callerObjectId;

softphoneWindow = window.open(url,'Softphone',strWindowFeatures);
}
function startCall(response) { 

var result = JSON.parse(response.result);
callerPhoneNumber = cleanFormatting(result.number);
var objId = result.objectId;
callerObjectId = objId;
sforce.interaction.runApex('CallerIdRetrivalService', 'getCallerId', 'contactId='+objId , callStartCall);

if(objId.substr(0,3)== '003'){
sforce.interaction.runApex('ContactsPhoneMatchService', 'getContactsPhoneMatch', 'conId='+objId+'&phoneNumber='+result.number, displayContacts);
}

} 

var displayContacts = function(response) {
if(response.result != undefined && response.result != null){
var objResult = JSON.parse(response.result); 
console.log(objResult.sfdcBaseUrl);
console.log(objResult.conDetList);

var table = document.createElement('table');

var tr = document.createElement('tr');
var th1 = document.createElement('th');

var text1 = document.createTextNode('Name');
th1.appendChild(text1);
tr.appendChild(th1);
table.appendChild(tr);
for (var i = 0; i < objResult.conDetList.length ; i++){
var tr = document.createElement('tr');   

var td1 = document.createElement('td');
var link = document.createElement('a');
link.setAttribute('href',objResult.sfdcBaseUrl+objResult.conDetList[i].Id);
link.setAttribute('target', "_blank");
link.setAttribute("class", "anchorClass");

var text1 = document.createTextNode(objResult.conDetList[i].name);
link.appendChild(text1);
td1.appendChild(link);
tr.appendChild(td1);

table.appendChild(tr);
}


if(document.getElementById('contactsList') != undefined && document.getElementById('contactsList') != null){
document.getElementById('contactsList').innerHTML = '';
document.getElementById('contactsList').appendChild(table);

}

}
}
var saveLogcallback = function (response) {
if (response.result) {
console.log("saveLog result =" + response.result);
} else {
console.log("saveLog error = " + response.error);
}
};


function saveLog(response) {


var result = response;

console.log(response);

var timeStamp = new Date().toString();
timeStamp = timeStamp.substring(0, timeStamp.lastIndexOf(':') + 3);             
var currentDate = new Date();           
var currentDay = currentDate.getDate();
var currentMonth = currentDate.getMonth()+1;
var currentYear = currentDate.getFullYear();
var dueDate = currentYear + '-' + currentMonth + '-' + currentDay;

//Map to hold the log data 
var saveParamsMap = {};

saveParamsMap['Subject'] = 'Call log';
saveParamsMap['Call on'] = timeStamp;
saveParamsMap['Status'] = 'Open';
saveParamsMap['CallType'] = 'Outbound';
saveParamsMap['Activitydate'] = dueDate;
saveParamsMap['Phone'] = result.phoneNumber;
saveParamsMap['Description'] = 'Call log for '+result.phoneNumber;

var objectidsubstr = result.objectId == undefined || result.objectId == null || result.objectId == '' ?  callerObjectId.substr(0,3) : result.objectId.substr(0,3); 
// object id 00Q means a lead.. adding this to support logging on leads as well as contacts.
if(objectidsubstr == '003' || objectidsubstr == '00Q') {

saveParamsMap['whoId'] = result.objectId == undefined || result.objectId == null || result.objectId == '' ?  callerObjectId : result.objectId;

} else {

saveParamsMap['whatId'] = result.objectId == undefined || result.objectId == null || result.objectId == '' ?  callerObjectId : result.objectId;
}

console.log("save params = " + JSON.stringify(saveParamsMap));

sforce.interaction.runApex('CallerTasklogService', 'generateCallLog', 'logParamsMap='+JSON.stringify(saveParamsMap), saveLogcallback);

}

});

