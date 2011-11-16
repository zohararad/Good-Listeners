/************************************************************************************
  This is your background code.
  For more information please visit our wiki site:
  http://crossrider.wiki.zoho.com/Background-Code.html
*************************************************************************************/


//Place your code here (ideal for handling toolbar button, global timers, etc.)
if(appAPI.platform === 'CH'){
  chrome.tabs.onSelectionChanged.addListener(function() {
    appAPI.message.toActiveTab({action:'update_listeners_count'});
  })
}

appAPI.message.addListener(function(msg){
  var action = msg.action || '';
  if(typeof(GL.callbacks[action]) === 'function'){
    GL.callbacks[action](msg.params);
  }
});

var GL = {
  callbacks:{
    'tts':function(params){
      params.options.onEvent = GL.callbacks.onSpeachEvent;
      chrome.tts.speak(params.phrase,params.options);
    },
    'stop_tts':function(){
      chrome.tts.stop()
    },
    set_page_trackers:function(params){
      GL.page_trackers = params.trackers;
    },
    onSpeachEvent:function(e){
      if(e.type === 'start'){
        appAPI.message.toActiveTab({action:'speach_start'});
      } else if(e.type === 'end'){
        appAPI.message.toActiveTab({action:'speach_end'});
      }
    }
  },
  page_trackers:null
}

