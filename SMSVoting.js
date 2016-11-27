// App sets a  quick SMS based poll where people can vote by sending <2 character prefix><Option Number>
// The app can also check if a user can vote only once.
// The app lets the administrator(guy with the phone) check the results, reset counters & also a test workbench to test the system by
//     typing in the "SMS-messages" using a inputBox

// Initializing variables. You might want to edit these constants 
var votePrefix = "VT";   // All SMS which don't start with this prefix are presumed to be not related to the poll(SPAM/personal SMS)
var maxCandidate = 6; 
var maxVotePerUser = 1;  // Set this as 100000 to ensure multiple votes from same user.

var candidateNames = [ 'Candidate 00','Candidate 01','Candidate 02','Candidate 03','Candidate 04','Candidate 05','Candidate 06',
   'Candidate 07','Candidate 08','Candidate 09','Candidate 10','Candidate 11','Candidate 12','Candidate 13','Candidate 14','Candidate 15',
   'Candidate 16','Candidate 17','Candidate 18','Candidate 19','Candidate 20','Candidate 21','Candidate 22','Candidate 23',
   'Candidate 24','Candidate 25'];
   

//Main Screen of the Application
function StartAppMenu()
{   
    var inputBox = device.notifications.createInputBox('Vote');
    inputBox.content = 'Type your vote or choose an option:';
    inputBox.value=votePrefix;
    inputBox.type = 'text';
    inputBox.buttons = [ 'Results','Reset','Vote' ];
    
    inputBox.on('Results', function() {
        ShowResults();
    });
    
    //This option allows users to test the application without waiting for SMSs
    inputBox.on('Vote', function() {
        AddThisVote(inputBox.value, "DummyPhone");
    });
       
    inputBox.on('Reset', function() {
        var secretMesgBox = device.notifications.createMessageBox('Reset Menu');
        secretMesgBox.content = 'Reset Storage:';
        secretMesgBox.buttons = [ 'All','Voters','Cancel' ];
    
        secretMesgBox.on('All', function() {
            device.db.delete("smsVoting.allPhoneNums",{});
            device.db.delete("smsVoting.allVotesCast",{});            
            showNotification('Deleted record of all votes & all voters');
            console.log('Deleted record of all votes & all voters');
        });    
        secretMesgBox.on('Voters', function() {
           device.db.delete("smsVoting.allPhoneNums",{});
           showNotification('Deleted record of all voters');
           console.log('Deleted record of all voters');
        });  
        secretMesgBox.on('Cancel', function() {
            console.log('No reset done at all');   
        });        
       secretMesgBox.show();       
    });
    
    inputBox.show();
}

//Show message on mobile
function showMessage(title, content)
{
    var messageBox = device.notifications.createMessageBox(title);
    messageBox.content = content;
    messageBox.buttons = [ 'Ok' ];
    messageBox.show();
}

//Display notification on mobile
function showNotification(content)
{
  var notification = device.notifications.createNotification(content);
  notification.show();
}

//Send SMS
function sendSmsFeedback(phoneNum, messageToSend)
{
     if(  phoneNum === "DummyPhone"  )   // This was a test message 
        return;
        
     device.messaging.sendSms({
         to: phoneNum,
         body: messageToSend 
         },
         function (err) {
             if (err) {
               console.error('Error sending text message: ' + JSON.stringify(err));
              }
          }
      );
}


function ShowResults()
{
  var msg="";
  var totalVotesCast=0;
  
  var cursor = device.db.query("smsVoting.allVotesCast",{});    
  cursor.groupBy({ tag: true }, function(item, state) { state.count++; }, { count: 0 }, function(err, groups){        
      for (var index in groups) {
         msg=msg+ candidateNames[groups[index].tag]  + ":" + groups[index].count + "\n";
         totalVotesCast = totalVotesCast+groups[index].count;
      }
      msg=msg+'\n Total Votes:' +totalVotesCast;
      showMessage('Votes Polled:', msg);     
      console.log('Votes Polled:'+ msg);
  });     
}

function AddThisVote(yourVote, yourPhone)
{     
    var temp = yourVote.toUpperCase(true);    
    var yourVoteIdx=-1;  
    
    //showNotification('Received Vote starting with ='+ temp.substr(0,4));    
    
    //Assume the message is in right format & has the vote Prefix 
    temp=temp.replace(votePrefix,'');
    yourVoteIdx=parseInt(temp,10);    

    if( isNaN(yourVoteIdx) || (yourVoteIdx < 0 || yourVoteIdx>=maxCandidate ) )
    {             
             console.log('Vote from '+ yourPhone + ', ['+ temp + '] is not in correct format');
             //showMessage('Vote from '+ yourPhone + ', ['+ temp + '] is not in correct format');
             //showNotification('Vote from '+ yourPhone + ', ['+ temp + '] is not in correct format'); 
             sendSmsFeedback(yourPhone,"Invalid input format, vote must in the format "+ votePrefix+"<0-"+ (maxCandidate -1) +">");                              
             return;
    } 
    else
    {
        console.log('Valid Vote:[' + yourVote + '] for [' + candidateNames[yourVoteIdx] + '] from ' + yourPhone );
        sendSmsFeedback(yourPhone,"Thanks for voting for "+ candidateNames[yourVoteIdx] + "." );    
               
        // Vote was taken successfully, so update the DB
        var votedPhoneNumber = {tag : yourPhone,utcTimestamp: new Date(), voteIdx:yourVoteIdx };
        device.db.insert("smsVoting.allPhoneNums", votedPhoneNumber);
        var voteCasted = { tag : yourVoteIdx,utcTimestamp: new Date() };
        device.db.insert("smsVoting.allVotesCast",voteCasted);  
    }
}


//Create the application Shortcut
device.shortcuts.create(appName, "VotingApp", "default");
device.shortcuts.on("VotingApp", function()
{
    StartAppMenu();   
});

device.messaging.on('smsReceived', function(sms){
    //extract just the 1st 4 characters
    yourVote=sms.data.body.substr(0,4).toUpperCase(true);
    showNotification('Received message :[' + yourVote +'] from '+ sms.data.from );
    
    // If the message does not start with <votePrefix> we assume that this SMS is not related to the poll.
    if ( yourVote.indexOf(votePrefix) > -1 )
    {  
      // Check if this number had voted before
      var now = new Date();
      var startTime = new Date();
      startTime.setHours(now.getHours() - 24);  //Voted in last 24 hours
      var query = { tag: sms.data.from, utcTimestamp: { start: startTime, end: now } };
      device.db.query("smsVoting.allPhoneNums", query).toArray(function(err, results){
         if (!err && results.length >= maxVotePerUser ){
             var timesMesg="once";
             if (maxVotePerUser > 1 ) timesMesg = "once"; else timesMesg=maxVotePerUser + " times";
             
             console.log("The number " + sms.data.from + " has voted " + timesMesg + " already.");
             showNotification("The number " + sms.data.from + " has voted " + timesMesg + " already");
             sendSmsFeedback(sms.data.from , "Sorry, but you can only vote "+ timesMesg + ".");             
          }
          else
          {
             AddThisVote(yourVote, sms.data.from);         
          }
       });   
        
    }
    console.log('Received SMS from ' + sms.data.from + ',message with starting 4 characters :' + yourVote );
});
