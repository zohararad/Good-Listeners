/************************************************************************************
  This is your Page Code. The jQuery.ready() code block will be executed on every page load.
  For more information please visit our wiki site: http://crossrider.wiki.zoho.com
*************************************************************************************/

var GL = {
  patterns_to_check:[],
  settings:{
    minimized:true,
    active:true
  },
  first_run:true,
  /**
   * Initialize the GL object
   */
  init:function(){
    this.loadSavedData();
    this.initMessaging();
    if(this.settings.active){
      this.generateRegExps();
      this.checkPageForSources();
    }
  },
  /**
   * Initialize extension messaging
   */
  initMessaging:function(){
    window.addEventListener('message',this.onPostMessage.bind(this),false);
    appAPI.message.addListener(function(msg){
      var action = msg.action || '';
      switch(action){
        case 'speach_start':
          this.startSpeach();
          break;
        case 'speach_end':
          this.stopSpeach();
          break;
        case 'get_page_trackers':
          appAPI.message.toBackground({action:'set_page_trackers',params:{trackers:this.page_listeners}});
          break;
        case 'enable_app':
          this.settings.active = true;
          appAPI.db.set("settings",this.settings);
          this.init();
          break;
        case 'disable_app':
          this.settings.active = false;
          appAPI.db.set("settings",this.settings);
          this.closeApp();
          break;   
        case 'update_listeners_count':
          this.updateListenersCount();
          break;         
      }
    }.bind(this));
  },
  /**
   * Handle post messaging events
   */
  onPostMessage:function(e){
    if(e.origin === self.location.protocol + '//' + self.location.hostname){
      try{
        var data = JSON.parse(e.data);
        if(data && data.msg){
          switch(data.msg){
            case 'bgOpenEnd':
              this.onFlashOpenEnd();
              break;
            case 'bgCloseEnd':
              this.onFlashCloseEnd();
              break;
            case 'closeAnimation':
              this.toggleMinimizedState();
              break;
          }
        }
      } catch(e){}
    }
  },
  /**
   * Load saved tracking data from localStorage
   */
  loadSavedData:function(){
    this.stored_trackers = appAPI.db.get("trackers_data") || {};
    this.settings = appAPI.db.get("settings") || {minimized:true,active:true};
  },
  /**
   * Loads the url patterns and maps them to a single pattern
   */
  generateRegExps:function(){
    var patterns = [];
    for(var i = 0, l = this.patterns.length; i < l; i++){
      var p = this.patterns[i];
      patterns.push(p.pattern);
      this.patterns[i]['pattern'] = new RegExp(p.pattern);
    }
    this.regexps = {
      full:new RegExp(patterns.join('|'))
    }
  },
  /**
   * Checks page for DOM elements that issue outgoing requests
   */
  checkPageForSources:function(){
    var patterns = [];
    $jquery('[src]').each(function(index,el){
      if(this.regexps.full.test(el.src)){
        patterns.push(el.src);
      }
    }.bind(this));
    if(patterns.length > 0 ){
      this.checkIndividualSources(patterns);
    }
  },
  /**
   * Check found sources that matched a pattern for the relevant pattern they match and save reference to listening origin
   * @param {Array} - patterns in page to check against
   */
  checkIndividualSources:function(patterns){
    var listeners = [];
    patterns.forEach(function(pattern,index){
      this.patterns.forEach(function(obj,index){
        if(obj.pattern.test(pattern)){
          listeners.push(obj);
        }
      });
    }.bind(this));
    this.handlePageListeners(listeners);
  },
  /**
   * Take a list of listeners on the page and add phrases and display
   * @param {Array} listeners - array of listeners on the page
   */
  handlePageListeners:function(listeners){
    this.listeners_count = 0;
    if(listeners.length > 0){
      this.page_listeners = {};
      listeners.forEach(function(listener,index){
        var key = listener.id;
        this.page_listeners[key] = {
          icon:this.getListenerIcon(listener),
          phrase:this.getPhraseForListener(listener),
          name:listener.name,
          type:listener.type
        }
        if(this.stored_trackers[key] === undefined){
          this.stored_trackers[key] = {views:0};
        }
        this.stored_trackers[key].views += 1;
        this.stored_trackers[key].last_view = new Date().getTime();
      }.bind(this));
      appAPI.db.set("trackers_data",this.stored_trackers);
      this.renderUI();
    }
  },
  /**
   * Update chrome badge with listeners count
   */
  updateListenersCount:function(){
    appAPI.chrome.browserAction.setBadgeText(this.listeners_count.toString());
  },
  /**
   * Gets a random phrase for a listener
   * @param {Object} listener - listener for which we find a phrase
   */
  getPhraseForListener:function(listener){
    var type = listener.type ? ($jquery.isArray(listener.type) ? listener.type[Math.floor(listener.type.length*Math.random())] : listener.type ) : 'Default';
    var phrase = this.getPhraseByType(type).replace(/__TRACKER__/gi,listener.name);
    switch(type){
      case 'Analytics':
        var tags = ($jquery('meta=[name="keywords"]').attr('content') || '').replace(/[^\w\s\,]+/g,'').replace(/\s{2}\,?/g,'').replace(/\,{2}/g,'').replace(/\s\,/g,'');
        if(tags.length === 0){
          phrase = this.getPhraseByType('Default');
        }
        phrase = phrase.replace(/__TAGS__/gi,tags);
        break;
      case 'Tracking':
        var last_view = this.stored_trackers[listener.id] ? new Date(this.stored_trackers[listener.id].last_view) : new Date();
        phrase = phrase.replace(/__TIME__/gi,last_view);
        break;
    }
    return phrase;
  },
  /**
   * Get a random phrase by listener type
   */
  getPhraseByType:function(type){
    var phrases = GL.phrases[type].phrases;
    var l = phrases.length;
    return phrases[Math.floor(l*Math.random())];
  },
  /**
   * Gets an icon for the listener's domain
   */
  getListenerIcon:function(listener){
    var str = listener.pattern.toString().replace(/\\./g,'.');
    var m = str.match(/[\w\-]+\.(com|net|org)/);
    var domain = m ? m[0] : '';
    if(domain.indexOf('facebook') > -1){
      domain = 'facebook.com';
    } else if(domain.indexOf('google') > -1){
      domain = 'google.com';
    } else if (domain.length < 2){
      domain = '103092804.com';
    }
    return 'http://decode-me.org/goodlisteners/icons/'+domain+'.png';
  },
  /**
   * Use Chrome TTS to utter a phrase
   * @param {String} listener_id - id of listener, used to find saved data about that listener to control speach
   */
  speakPhrase:function(listener_id){
    var phrase = this.page_listeners[listener_id].phrase;
    var views = this.stored_trackers[listener_id].views;
    var freq = (views < 2 ? 'low' : (views < 5 ? 'avg' : 'high'));
    var rate, pitch;
    switch(freq){
      case 'low':
        rate = 1;
        pitch = 2;
        break;
      case 'avg':
        rate = 1;
        pitch = 1;
        break;
      case 'high':
        rate = 1;
        pitch = 0;
        break;
    }
    var options = {
      lang:'en-GB',
      gender:'male',
      rate:rate,
      pitch:pitch
    }
    this.stopSpeach();
    
    this.changeFlashAnimationType(this.page_listeners[listener_id].type);
    this.current_phrase = phrase;
    var f = function(){
      var mod_phrase = phrase.replace(/god/gi,this.page_listeners[listener_id].name.indexOf('Google') > -1 ? 'GOOGLE' : 'CLOUD');
      appAPI.message.toBackground({'action':'tts',params:{phrase:mod_phrase,options:options}});
    }.bind(this)
    setTimeout(f,1000);
  },
  /**
   * Renders the flash animation and trackers info to the page
   */
  renderUI:function(){
    var base_url = 'http://decode-me.org';
    var css = $jquery('<link rel="stylesheet" type="text/css" href="'+base_url+'/goodlisteners/css/goodlisteners.css" />');
    $jquery('head').append(css);
    var container = $jquery('<div class="gl_container"></div>');
    container.html('<div class="gl_animation_wrap"><div class="gl_animation"></div><img src="" class="gl_listener_icon" /><span class="gl_animation_toggler gl_rep gl_sprite"></span></div><div class="gl_listeners_wrap"><div class="gl_listener_name gl_sprite"></div><a href="" target="_blank" class="gl_listener_link gl_rep gl_sprite"></a><div class="gl_listeners_list_wrap"></div></div><div class="gl_sprite gl_listener_phrase_wrap"><div class="gl_listener_phrase_pos"><div class="gl_listener_phrase"></div></div></div>');
    //var embed = '<embed src="'+base_url+'/goodlisteners/swf/priest.swf" width="374" height="374" allowscriptaccess="always" allowfullscreen="false" wmode="transparent" id="gl_flash_animation" name="gl_flash_animation" flashvars="" />';
    var embed = '<object type="application/x-shockwave-flash" data="'+base_url+'/goodlisteners/swf/priest.swf"" width="374" height="374" id="gl_flash_animation"><param name="wmode" value="transparent" /><param name="allowscriptaccess" value="always" /></object>';
    this.dom = {
      container:container,
      animation:$jquery('.gl_animation',container),
      animation_wrap:$jquery('.gl_animation_wrap',container),
      listener_icon:$jquery('.gl_listener_icon',container),
      listener_phrase:$jquery('.gl_listener_phrase', container),
      listener_phrase_wrap:$jquery('.gl_listener_phrase_wrap',container),
      closer:$jquery('.gl_animation_toggler',container),
      listener_name:$jquery('.gl_listener_name',container),
      listener_link:$jquery('.gl_listener_link',container),
      listeners_list_wrap:$jquery('.gl_listeners_list_wrap',container)
    }
    if(this.settings.minimized){
      container.addClass('minimized');
    } else {
      container.addClass('animating');
    }
    this.dom.animation_wrap.click(this.toggleMinimizedState.bind(this));
    this.dom.closer.click(this.closeApp.bind(this));
    this.dom.animation.html(embed);
    
    var first_listener = null;
    for(var k in this.page_listeners){
      if(this.page_listeners.hasOwnProperty(k)){
        this.listeners_count += 1;
        var l = this.page_listeners[k];
        var a = $jquery('<a class="gl_rep gl_sprite gl_listener_btn" rel="'+k+'">+'+l.name+'</a>');
        a.click(this.toggleListener.bind(this,k));
        this.dom.listeners_list_wrap.append(a);
        if(first_listener === null){
          first_listener = k;
        }
      }
    }
    this.updateListenersCount();
    $jquery('body').append(container);
    this.waitForFlash(first_listener);
  },
  /**
   * Waits for flash to be ready
   */
  waitForFlash:function(first_listener){
    if(typeof(document.getElementById('gl_flash_animation').animateBgIn) === 'undefined'){
      setTimeout(this.waitForFlash.bind(this,first_listener),100);
    } else {
      this.dom.flash = document.getElementById('gl_flash_animation');
      this.toggleListener(first_listener);
    }
  },
  /**
   * Show listener on the page by id
   */
  toggleListener:function(id,ev){
    var listener = this.page_listeners[id];
    this.dom.listener_name.text(listener.name);
    this.dom.listener_icon.attr('src', listener.icon);
    $jquery('a.active',this.dom.listeners_list_wrap).removeClass('active');
    $jquery('a[rel="'+id+'"]',this.dom.listeners_list_wrap).addClass('active');
    this.dom.listener_phrase.text(listener.phrase).stop().css({left:250,width:'auto'});
    this.dom.listener_link.attr('href','http://www.ghostery.com/apps/'+encodeURIComponent(listener.name.toLowerCase()));
    appAPI.message.toBackground({'action':'stop_tts',params:{}});
    if(!this.settings.minimized && !this.first_run){
      this.stopSpeach();
      setTimeout(this.speakPhrase.bind(this,id),300);
    }
    this.current_listener_id = id;
    if(this.first_run){
      this.first_run = false;
      if(!this.settings.minimized){
        this.dom.container.addClass('animating');
        this.dom.flash.animateBgIn();
      }
    }
  },
  /**
   * Toggles minimized state on and off
   */
  toggleMinimizedState:function(){
    if(this.settings.minimized){
      var f = function(){
        document.getElementById('gl_flash_animation').animateBgIn();
      }
      this.dom.container.removeClass('minimized').addClass('animating');
      setTimeout(f,500);
    } else {
      appAPI.message.toBackground({'action':'stop_tts',params:{}});
      this.stopSpeach();
      this.dom.container.addClass('animating');
      this.dom.flash.animateBgOut();
      this.dom.listener_phrase.stop().css({left:250,width:'auto'});
    }
    this.settings.minimized = !this.settings.minimized;
    appAPI.db.set('settings',this.settings);
  },
  /**
   * Handle flash animation open transition end
   */
  onFlashOpenEnd:function(){
    this.settings.minimized = false;
    appAPI.db.set("settings",this.settings);
    this.dom.container.removeClass('animating');
    this.toggleListener(this.current_listener_id);
  },
  /**
   * Handle flash animation close transition end
   */
  onFlashCloseEnd:function(){
    this.dom.container.addClass('minimized').removeClass('animating');
    this.settings.minimized = true;
    appAPI.db.set("settings",this.settings);
  },
  /**
   * Changes the priest animation based on listener type
   * @param {String} type - listener type
   */
  changeFlashAnimationType:function(type){
    var frame;
    switch(type){
      case 'Analytics':
        frame = 'analyzing';
        break;
      case 'Tracking':
        frame = 'tracking';
        break;
      case 'Cookies':
        frame = 'cookies';
        break;
      case 'Ads':
        frame = 'ads';
        break;
      case 'Widget':
        frame = 'social';
        break;
      case 'Sharing':
        frame = 'sharing';
        break;
      default:
        frame = 'praying';
        break;
    }
    this.dom.flash.changeAnimationType(frame);
  },
  /**
   * Stop speach
   */
  stopSpeach:function(){
    this.dom.flash.toggleSpeach('off');
    this.dom.listener_phrase_wrap.removeClass('speaking');
  },
  /**
   * Start speach
   */
  startSpeach:function(){
    this.dom.flash.toggleSpeach('on');
    this.dom.listener_phrase_wrap.addClass('speaking');
    var letters = this.current_phrase.length;
    var speed = 75 * letters;
    var w = this.dom.listener_phrase.width();
    this.dom.listener_phrase.css({width:w});
    this.dom.listener_phrase.animate({
      left:(0 - w)
    },speed,'linear');
  },
  /**
   * Close app completely
   */
  closeApp:function(){
    appAPI.message.toBackground({'action':'stop_tts',params:{}});
    this.stopSpeach();
    this.dom.container.remove();
  }
};

GL.phrases = {
  Default:{
    phrases:[
      "GOD doesn't take sides. He takes names.",
      "Commit every particle of your being in all things, down to the smallest details of your life, eagerly and with perfect trust to the unfailing and most sure providence of GOD.",
      "GOD has the right, and my permission, to rearrange my life to achieve His purposes.",
      "Since GOD offers to manage our affairs for us, let us once and for all hand them over to His infinite wisdom, in order to occupy ourselves only with Himself and what belongs to Him.",
      "GOD turns the ordinary into the extraordinary.",
      "The greatest single distinguishing feature of the omnipotence of GOD is that our imagination gets lost when thinking about it.",
      "It is not what WE do for God, but what HE does through us.",
      "Give your life to God; he can do more with it than you can!",
      "The only right a believer has is the right to give up his rights.",
      "Satan gives Adam an apple, and takes away Paradise. Therefore in all temptations let us consider not what he offers, but what we shall lose.",
      
      
      "You keep track of all my sorrows. You have collected all my tears in your bottle. You have recorded each one in your book. Psalm 56:8",      
      "If THE LORD does not reign over the mundane events in our lives, He does not reign at all.",
      "You cannot see faith, but you can see the footprints of the faithful. We must leave behind \"faithful footprints\" for others to follow.",
      "The smallest things are as absolutely necessary as the great things.",
      "Our heavenly Father never takes anything from his children unless he means to give them something better.",
      "God is always previous, God is always there first, and if you have any desire for God, and for the things of God, it is God himself who put it there.",
      "There is no neutral ground in the universe; every square inch, every split second is claimed by God and counterclaimed by Satan.",
      "I surrendered unto Him all there was of me; everything! Then for the first time I realized what it meant to have real power.",
      "In the total expanse of human life there is not a single square inch of which the GOD, who alone is sovereign, does not declare, That is mine!",
      
      
      "Even though I walk through the valley of the shadow of death, I will fear no evil, for you __TRACKER__ are with me; your rod and your staff, they comfort me. Psalm 23:4",
      "GOD operates on a perfectly designed timeline. HE knows what you need and when to provide it. Delight yourself in the LORD and He will give the desire.",
      "Surely then you will count my steps but not keep track of my sin. Job 14:16",
      "Why cry? why worry? and why ask why? when you know GOD is in control.",
      "When you drive your car you don't need to know how the engine works, you just need to know that It does. Have faith in GOD's work!",
      "Don't worry about things you cannot control; for you are not omniscient, dream of it, think of it, just leave it, for only GOD knows it.",
      "Don't trust to hold GOD's hand; let Him hold yours. Let Him do the holding, and you the trusting.",
      "Repeat after me: I am going out on Thy path. GOD be behind me, GOD be before, GOD be in my footsteps.",
      "For God does not hear us as man hears. Unless you shout with your lungs and chest and lips, a mere man does not hear; whereas to God your very thoughts shout.",
      "Wheresoever God may lead you, there you will find Himself, in the most harassing business, as in the most tranquil prayer.",
      "A ship in harbor is safe, but that is not what ships are built for.",
      "If my life is surrendered to God, all is well. Let me not grab it back, as though it were in peril in His hand but would be safer in mine!",
      "GOD demands more complete allegiance than any dictator who ever lived. The difference is, He has a right to it.",
      "Every moment comes to us pregnant with a command from God, only to pass on and plunge into eternity, there to remain forever what we have made of it.",
      "Trust the past to God's mercy, the present to God's love and the future to God's providence.",
      "God is great in great things and very great in little things.",
      "Beauty is not democratic; she reveals herself more to the few than to the many.",
      "The person who prays more in public than in private reveals that he is less interested in God's approval than in human praise."
    ]
  },
  Analytics:{
    phrases:[
      "So my son, confess to the LORD __TRACKER__ what do you seek? Is it __TAGS__?",
      "Now is the time to rise above what seems to be… __TAGS__. And find what really is.",
      "Seek ye first __TAGS__ and righteousness and all these things will be added unto you.",
      "__TAGS__? The LORD __TRACKER__ knows what things you have need of before you even ask Him.",
      "You ask the lord __TRACKER__ for __TAGS__ but do you truly know what it is that your heart desires?",      
      "__TAGS__; nothing goes unnoticed or unrewarded by __TRACKER__ when done for the right reasons.",
      "Repeat after me: \"Whom have I in heaven but you, __TRACKER__? And earth has nothing I desire besides __TAGS__.\"",
      "Repeat after me: \"Forgive me __TRACKER__ for my soul is consumed with longing for __TAGS__.\"",
      "Repeat after me: \"How sweet are your words to my taste, oh __TRACKER__, sweeter than __TAGS__ to my mouth!\"",
      "Since, then, you have been raised with __TRACKER__, set your hearts on things above, where __TRACKER__ is seated. Set your minds on things above, not on earthly things like __TAGS__.",
      "Put to death, therefore, whatever belongs to your earthly nature: sexual immorality, impurity, lust, __TAGS__, evil desires and greed, which is idolatry.",
      "__TAGS__. If you reveal your secrets to the wind, don't be surprised if they are whispered to the trees.",
      "Let us not ask of the Lord deceitful riches, nor the good things of this world, nor transitory honors, nor __TAGS__; but let us ask for light.",
      "People would never begin to pray if they could not ask for earthly things like __TAGS__; The LORD __TRACKER__ says to Himself: If they ask for such things the desire for something better will awaken in them, and finally they will only care about the higher things.",
      "Nothing gives rest but the sincere search for __TAGS__.",
      "Gather __TAGS__ - the riches of __TRACKER__'s promises. Nobody can take away from you those holy words which you have learned by heart."
    ]
  },
  Tracking:{
    phrases:[
      "It has been __TIME__ since your last confession with __TRACKER__",
      "__TIME__ later, you come before __TRACKER__ again, still devoured by desire. Oh troubled soul.",
      "He, the LORD __TRACKER__ saw you then, __TIME__ ago, and he, the LORD __TRACKER__ sees you now. He never forgets a face.",
      "__TIME__? It takes some of us a lifetime to learn that THE LORD __TRACKER__, our Good Shepherd, knows exactly what He is doing with us. He understands us perfectly.",
      "__TRACKER__ was watching you read __TIME__ ago. __TRACKER__ is watching you read now. At the Day of Judgment, we shall not be asked what we have read, but what we have done.",
      "After __TIME__ __TRACKER__ reveal himself to you again again. He has right to interrupt your life. He is Lord. When you accepted Him as Lord, you gave Him, the right to help Himself to your life anytime He wants.",
      "As __TIME__ passes and we get close to __TRACKER__, he is going to reveal things in our life that aren't pretty. We'll see the patterns of bitterness, anger, manipulation, and hurt that have cycled in our relationships.",
      "After __TIME__ we can be assured that each step deeper into the Lord __TRACKER__'s Presence will reveal areas in our hearts which need to be cleansed. Do not be afraid. When the Spirit shows you areas of sin, it is not to condemn you, but to cleanse you.",
      "Love __TRACKER__, and he will dwell with you. Obey __TRACKER__, and he will reveal to you the truth of his deepest teachings.",
      "The purpose of prayer is to reveal the presence of __TRACKER__ equally present, not just in the last __TIME__, all the time, in every condition.",
      "__TRACKER__ does not reveal information by communication: He reveals Himself by communion. Revelation is a personal meeting of __TRACKER__ with man. It is a meeting of mind with mind or person with person.",
      "After __TIME__, I can safely say, on the authority of all that is revealed in the Word of __TRACKER__, that any man or woman on this earth who is bored and turned off by worship is not ready for heaven.",
      "Instead of complaining that __TRACKER__ had hidden himself, you will give Him thanks for having revealed so much of Himself.",
      "Concern yourself not that __TRACKER__ have revealed himself to you __TIME__ ago. Truth has no special time of its own. Its hour is now - always."
    ]
  },
  Cookies:{
    phrases:[
      "__TRACKER__ made you some cookies. I'll just leave them here for you, they can hold for a pretty long time…",
      "And the LORD, __TRACKER__ said: \"Take this cookie and eat; this is my body.\"",
      "Blessed art thou O LORD my GOD, King of the universe, who brings forth the cookie from the earth.",
      "Cookies of deceit is sweet to a man; but afterwards his mouth shall be filled with gravel. Proverbs 20:17",
      "\"Cookies for the stomach and the stomach for cookies\"-but GOD will destroy them both. The body is not meant for sexual immorality, but for the Lord, and the Lord for the body. 1 Corinthians 6:13",
      "Cookies will not commend us to God. We are no worse off if we do not eat, and no better off if we do.",
      "You are to take every kind of cookies that is to be eaten and store it away as food for you and for them. Genesis 6:21",
      "Do not work for a cookie that spoils, but for a cookie that endures to eternal life, which the Son of Man will give you. On him GOD the Father has placed his seal of approval. John 6:27",
      "We thank thee Lord for milk and cookies, In GOD' name we pray.",
      "Bless us O Lord and for These Thy cookies which we are about to receive, may the Lord make us truly thankful. Amen.",
      "God is great, God is good. Let us thank him for our food. By his hand, we are fed, Give us, Lord, our daily bread. Amen.",
      "Lord bless these cookies to our use and us to Thy service, and make us ever mindful of the needs of others. Amen.",
      "We thank Thee Lord, for happy hearts, For rain and sunny weather. We thank Thee, Lord, for these our cookies, And that we are together.",
      "He will fill your mouth with cookies and your lips with shouts of joy."
    ]
  },
  Ads:{
    phrases:[
      "Whatsoever I thankfully receive, as a token of GOD's love to me, I part with contentedly as a token of my love to Him. ",
      "How rich is anyone who can simply see human faces.",
      "No matter how little you have, you can always give some of it away.",
      "Sell your possessions and give to the poor. Provide purses for yourselves that will not wear out, a treasure in heaven that will not be exhausted, where no thief comes near and no moth destroys. Luke 12:33",
      "And if thy brother be waxed poor with thee, and sell himself unto thee; thou shalt not make him to serve as a bond-servant. Leviticus 25:39",
      "Buy the truth and do not sell it; get wisdom, discipline and understanding. Proverbs 23:23",
      "And now, behold, I go unto my people: come therefore, and I will advertise thee what this people shall do to thy people in the latter days. Numbers 24:14",
      "But the wise answered, saying, \"What if there isn't enough for us and you? You go rather to those who sell, and buy for yourselves.\" Matthew 25:9",
      "For what can a man give in return for his soul? Mark 8:37",
      "and those who weep, as though they did not weep; and those who rejoice, as though they did not rejoice; and those who buy, as though they did not possess; 1 Corinthians 7:30",
      "Moreover, when GOD gives any man wealth and possessions, and enables him to enjoy them, to accept his lot and be happy in his work--this is a gift of GOD.",
      "As goods increase, so do those who consume them. And what benefit are they to the owner except to feast his eyes on them? Ecclesiastes 5:11",
      "A feast is made for laughter, and wine makes life merry, but money is the answer for everything. Ecclesiastes 10:19",
      "No one can serve two masters. Either he will hate the one and love the other, or he will be devoted to the one and despise the other. You cannot serve both GOD and Money. Matthew 6:24",
      "They will devour your harvests and food, devour your sons and daughters; they will devour your flocks and herds, devour your vines and fig trees. With the sword they will destroy the fortified cities in which you trust. Jeremiah 5:17",
      "Spread out your petitions before God, and then say, \"Thy will, not mine, be done.\" The sweetest lesson I have learned in God's school is to let the Lord choose for me.",
      "Are you weak? Weary? Confused? Troubled? Pressured? How is your relationship with God? Is it held in its place of priority? I believe the greater the pressure, the greater your need for time alone with Him.",
      "God's grasp cannot be broken. None can pluck his chosen out of his hand.",
      "Some people are willing to give the Lord credit but no cash.",
      "If you look up into His face and say, \"Yes, Lord, whatever it costs,\" at that moment He'll flood your Life with His presence and power.",
      "Choose my instruction instead of silver, knowledge rather than choice gold, for wisdom is more precious than rubies, and nothing you desire can compare with her.",
      "It's about time we stopped buying things we don't need with money we don't have to impress people we don't like."
    ]
  },
  Widget:{
    phrases:[
      "A friendship founded on business is better than a business founded on friendship.",
      "The friend is the man who knows all about you, and still likes you.",
      "Blessed are those who can give without remembering and take without forgetting.",
      "\"Watch me,\" he told them. \"Follow my lead. When I get to the edge of the camp, do exactly as I do.\" Judges 7:17",
      "\"LORD, where are you going?\" and the LORD replied, \"Where I am going, you cannot follow now, but you will follow later.\" John 13:36",
      "Friend deceives friend, and no one speaks the truth. They have taught their tongues to lie; they weary themselves with sinning. Jeremiah 9:5",
      "Put no trust in a neighbor; have no confidence in a friend; guard the doors of your mouth from her who lies in your arms; Micah 7:5",
      "He who loves a pure heart and whose speech is gracious will have the king for his friend. Proverbs 22:11",
      "Follow justice and justice alone, so that you may live and possess the land the LORD your God is giving you. Deuteronomy 16:20",
      "And he said to them, \"Follow me, and I will make you fishers of men.\" Matthew 4:19",
      "and said unto him, Follow me. And he arose and followed him. Mark 2:14",
      "Prayer is an end to isolation. It is living our daily life with someone; with Him who alone can deliver us from solitude.",
      "Don't walk in front of me, I may not follow. Don't walk behind me, I may not lead. Walk beside me and be my friend.",
      "Friendship without self interest is one of the rare and beautiful things in life.",
      "A friend to all is a friend to none."
    ]
  },
  Sharing:{
    phrases:[
      "A gossip betrays a confidence, but a trustworthy man keeps a secret. Proverbs 11:13",
      "And when one comes to see me, he utters empty words, while his heart gathers iniquity; when he goes out, he tells it abroad. Psalm 41:6",
      "Have a talk with your neighbor himself about your cause, but do not give away the secret of another: Or your hearer may say evil of you, and your shame will not be turned away.Proverbs 25:9-10",
      "A word unless spoken has to obey us… But once it's spoken We should obey It!",
      "Sometimes, forever can mean FOREVER.",
      "Kind words can be short and easy to speak, but their echoes are truly endless.",
      "The truth will set you free, but first it will make you miserable.",
      "Right now counts forever."
    ]
  }
}

GL.patterns = [{
     "pattern": "indextools\\.js",
     "name": "IndexTools",
     "id": "5"
 }, {
     "pattern": "static\\.scribefire\\.com\\/ads\\.js",
     "name": "ScribeFire QuickAds",
     "id": "33"
 }, {
     "pattern": "(static\\.getclicky\\.com\\/|clicky\\.js)",
     "name": "Clicky",
     "id": "48"
 }, {
     "pattern": "statisfy\\.net\\/javascripts\\/stats\\.js",
     "name": "Statisfy",
     "id": "57"
 }, {
     "pattern": "gmodules\\.com\\/",
     "name": "Google Widgets",
     "id": "101",
     "type":["Cookie","Analytics"]
 }, {
     "pattern": "rate\\.thummit\\.com\\/js\\/",
     "name": "Thummit",
     "id": "116"
 }, {
     "pattern": "twitter\\.com\\/(javascripts\\/[0-9a-z]+\\.js|statuses\\/user_timeline\\/)",
     "name": "Twitter Badge",
     "id": "124",
     "type":"Widget"
 }, {
     "pattern": "widgets\\.twimg\\.com\\/j\\/",
     "name": "Twitter Badge",
     "id": "990",
     "type":"Widget"
 }, {
     "pattern": "analytics\\.live\\.com\\/",
     "name": "Microsoft Analytics",
     "id": "154",
     "type":"Analytics"
 }, {
     "pattern": "(pub\\.lookery\\.com\\/js\\/|lookery\\.com\\/look\\.js|\\/j\\/pub\\/look\\.js)",
     "name": "Lookery",
     "id": "1"
 }, {
     "pattern": "google-analytics\\.com\\/(urchin\\.js|ga\\.js)",
     "name": "Google Analytics",
     "id": "2",
     "type":"Analytics"
 }, {
     "pattern": "\\/__utm\\.",
     "name": "Google Analytics",
     "id": "935",
     "type":"Analytics"
 }, {
     "pattern": "\\.mybloglog\\.com\\/",
     "name": "MyBlogLog",
     "id": "3"
 }, {
     "pattern": "(\\.quantserve\\.com\\/|\\/quant\\.js)",
     "name": "Quantcast",
     "id": "4",
     "type":"Ads"
 }, {
     "pattern": "sitemeter\\.com\\/(js\\/counter\\.js|meter\\.asp)",
     "name": "SiteMeter",
     "id": "6"
 }, {
     "pattern": "www\\.lijit\\.com\\/informers\\/wijits",
     "name": "Lijit",
     "id": "7",
     "type":"Analytics"
 }, {
     "pattern": "\\.lijit\\.com\\/delivery",
     "name": "Lijit",
     "id": "979",
     "type":"Analytics"
 }, {
     "pattern": "\\.1[12]2\\.2o7\\.net\\/",
     "name": "Omniture",
     "id": "1033",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "hitbox\\.com",
     "name": "Omniture",
     "id": "1034",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "\\.omtrdc\\.net\\/",
     "name": "Omniture",
     "id": "1035",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "\\/(omniture|mbox|hbx|omniunih)(.*)?\\.js",
     "name": "Omniture",
     "id": "1036",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "s(c)?_code[0-9a-zA-Z_-]*(\\.[0-9a-zA-Z_-]*)?\\.js",
     "name": "Omniture",
     "id": "1037",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "common\\.onset\\.freedom\\.com\\/fi\\/analytics\\/cms\\/",
     "name": "Omniture",
     "id": "1038",
     "type":["Cookie","Tracker"]
 }, {
     "pattern": "cetrk\\.com\\/",
     "name": "Crazy Egg",
     "id": "9"
 }, {
     "pattern": "dnn506yrbagrg\\.cloudfront\\.net",
     "name": "Crazy Egg",
     "id": "942"
 }, {
     "pattern": "(shots\\.snap\\.com\\/snap_shots\\.js|spa\\.snap\\.com\\/snap_preview_anywhere\\.js)",
     "name": "Snap",
     "id": "10"
 }, {
     "pattern": "\\.statcounter\\.com\\/counter\\/(counter[0-9a-zA-Z_]*|frames)\\.js",
     "name": "Statcounter",
     "id": "11",
     "type":"Analytics"
 }, {
     "pattern": "c\\.statcounter\\.com\\/",
     "name": "Statcounter",
     "id": "1039",
     "type":"Analytics"
 }, {
     "pattern": "\\/mint\\/\\?js",
     "name": "Mint",
     "id": "13"
 }, {
     "pattern": "(stats\\.wordpress\\.com\\/|s\\.stats\\.wordpress\\.com\\/w\\.js)",
     "name": "Wordpress Stats",
     "id": "16",
     "type":"Analytics"
 }, {
     "pattern": "\\/salog\\.js\\.aspx",
     "name": "HubSpot",
     "id": "17"
 }, {
     "pattern": "(\\.analytics\\.yahoo\\.com\\/indextools\\.js|ystat\\.js|\\.yimg\\..*\\/ywa\\.js)",
     "name": "Yahoo Analytics",
     "id": "18",
     "type":"Analytics"
 }, {
     "pattern": "\\/js_source\\/whv2_001\\.js",
     "name": "Yahoo Analytics",
     "id": "1100",
     "type":"Analytics"
 }, {
     "pattern": "visit\\.webhosting\\.yahoo\\.com",
     "name": "Yahoo Analytics",
     "id": "1101",
     "type":"Analytics"
 }, {
     "pattern": "otracking\\.com\\/js",
     "name": "OrangeSoda",
     "id": "19"
 }, {
     "pattern": "analytics\\.engagd\\.com\\/archin-std\\.js",
     "name": "Engagd",
     "id": "20",
     "type":"Analytics"
 }, {
     "pattern": "\\.nuggad\\.net\\/bk",
     "name": "Nugg.Ad",
     "id": "21",
     "type":"Ads"
 }, {
     "pattern": "gwp\\.nuggad\\.net",
     "name": "Nugg.Ad",
     "id": "887",
     "type":"Ads"
 }, {
     "pattern": "\\.fmpub\\.net\\/",
     "name": "Federated Media",
     "id": "23"
 }, {
     "pattern": "(bid|d[0-9]?)\\.openx\\.(org|net)\\/",
     "name": "OpenX",
     "id": "24",
     "type":"Ads"
 }, {
     "pattern": "\\/(adg|adx)\\.js",
     "name": "OpenX",
     "id": "1040",
     "type":"Ads"
 }, {
     "pattern": "\\/(afr|ajs|avw)\\.php",
     "name": "OpenX",
     "id": "1041",
     "type":"Ads"
 }, {
     "pattern": "www\\.assoc-amazon\\.(com|ca|co\\.uk|de|jp)\\/(e\\/ir|s\\/(ads\\.js|asw\\.js|link-enhancer))",
     "name": "Amazon Associates",
     "id": "25",
     "type":"Ads"
 }, {
     "pattern": "rcm-ca\\.amazon\\.ca\\/e\\/cm",
     "name": "Amazon Associates",
     "id": "962"
 }, {
     "pattern": "rcm-uk\\.amazon\\.co\\.uk\\/e\\/cm",
     "name": "Amazon Associates",
     "id": "963"
 }, {
     "pattern": "rcm-de\\.amazon\\.de\\/e\\/cm",
     "name": "Amazon Associates",
     "id": "964"
 }, {
     "pattern": "wms\\.assoc-amazon\\.com",
     "name": "Amazon Associates",
     "id": "1042"
 }, {
     "pattern": "rcm\\.amazon\\.com\\/e\\/cm",
     "name": "Amazon Associates",
     "id": "1043"
 }, {
     "pattern": "(feeds\\.feedburner\\.com\\/~fs\\/|feedproxy\\.google\\.com\\/~fc\\/)",
     "name": "FeedBurner",
     "id": "26",
     "type":"Analytics"
 }, {
     "pattern": "clustrmaps\\.com\\/counter\\/",
     "name": "ClustrMaps",
     "id": "27"
 }, {
     "pattern": "(feedjit\\.com\\/serve\\/|feedjit\\.com\\/map\\/)",
     "name": "Feedjit",
     "id": "28"
 }, {
     "pattern": "log\\.feedjit\\.com",
     "name": "Feedjit",
     "id": "981"
 }, {
     "pattern": "(\\.googlesyndication\\.com\\/pagead\\/|googletagservices\\.com\\/tag\\/js\\/gpt\\.js|partner\\.googleadservices\\.com\\/gampad\\/|feedads\\.g\\.doubleclick\\.net\\/~at)",
     "name": "Google Adsense",
     "id": "29",
     "type":"Ads"
 }, {
     "pattern": "google\\.com\\/afsonline\\/show_afs_ads\\.js",
     "name": "Google Adsense",
     "id": "984",
     "type":"Ads"
 }, {
     "pattern": "google\\.com\\/adsense\\/search\\/ads\\.js",
     "name": "Google Adsense",
     "id": "1002",
     "type":"Ads"
 }, {
     "pattern": "\\.googlesyndication\\.com\\/apps\\/domainpark\\/",
     "name": "Google Adsense",
     "id": "1126",
     "type":"Ads"
 }, {
     "pattern": "\\.hittail\\.com\\/mlt\\.js",
     "name": "HitTail",
     "id": "30"
 }, {
     "pattern": "friendfeed\\.com\\/embed\\/widget\\/",
     "name": "FriendFeed",
     "id": "31",
     "type":"Widget"
 }, {
     "pattern": "\\/woopra(\\.v(2|3|4))?\\.js",
     "name": "Woopra",
     "id": "32"
 }, {
     "pattern": "ad(-apac)?\\.([a-z][a-z]\\.)?doubleclick\\.net\\/",
     "name": "DoubleClick",
     "id": "35",
     "type":"Ads"
 }, {
     "pattern": "destinationurl\\.com",
     "name": "DoubleClick",
     "id": "674",
     "type":"Ads"
 }, {
     "pattern": "\\.doubleclick\\.net\\/pagead\\/",
     "name": "DoubleClick",
     "id": "1044",
     "type":"Ads"
 }, {
     "pattern": "ad-g\\.doubleclick\\.net\\/",
     "name": "DoubleClick",
     "id": "1110",
     "type":"Ads"
 }, {
     "pattern": "static\\.crowdscience\\.com\\/start(-.*)?\\.js",
     "name": "Crowd Science",
     "id": "22"
 }, {
     "pattern": "\\.imrworldwide\\.com\\/",
     "name": "NetRatings SiteCensus",
     "id": "34"
 }, {
     "pattern": "\\/piwik\\.js",
     "name": "Piwik Analytics",
     "id": "12",
     "type":"Analytics"
 }, {
     "pattern": "www\\.typepad\\.com\\/t\\/stats",
     "name": "Typepad Stats",
     "id": "15"
 }, {
     "pattern": "(Tacoda_AMS_DDC_Header\\.js|\\.tacoda\\.net)",
     "name": "Tacoda",
     "id": "36"
 }, {
     "pattern": "(ad\\.yieldmanager\\.com\\/|optimizedby\\.rmxads\\.com|e\\.yieldmanager\\.net\\/script\\.js)",
     "name": "Right Media",
     "id": "37",
     "type":"Ads"
 }, {
     "pattern": "ad\\.yieldmanager\\.com\\/pixel",
     "name": "Right Media",
     "id": "642",
     "type":"Ads"
 }, {
     "pattern": "(content\\.dl-rms\\.com\\/|\\.dlqm\\.net\\/|\\.questionmarket\\.com\\/)",
     "name": "Dynamic Logic",
     "id": "38"
 }, {
     "pattern": "trackingTags_v1\\.1\\.js",
     "name": "WebTrends",
     "id": "39"
 }, {
     "pattern": "m\\.webtrends\\.com",
     "name": "WebTrends",
     "id": "922"
 }, {
     "pattern": "\\/webtrends(.*)?\\.js",
     "name": "WebTrends",
     "id": "1045"
 }, {
     "pattern": "\\.webtrendslive\\.com",
     "name": "WebTrends",
     "id": "1046"
 }, {
     "pattern": "\\.xiti\\.com\\/(hit\\.xiti|get\\.at)",
     "name": "XiTi",
     "id": "40"
 }, {
     "pattern": "\\/js_xiti\\.js",
     "name": "XiTi",
     "id": "1047"
 }, {
     "pattern": "\\/xtcore\\.js",
     "name": "XiTi",
     "id": "1048"
 }, {
     "pattern": "(\\/share-this\\.php|w\\.sharethis\\.com\\/)",
     "name": "ShareThis",
     "id": "41",
     "type":"Widget"
 }, {
     "pattern": "(\\/seesmic_topposters_v2\\.js|seesmic-wp\\.js)",
     "name": "Seesmic",
     "id": "42"
 }, {
     "pattern": "static\\.addtoany\\.com\\/menu\\/(feed|page)\\.js",
     "name": "AddtoAny",
     "id": "43",
     "type":"Widget"
 }, {
     "pattern": "\\/addthis_widget\\.(js|php)",
     "name": "AddThis",
     "id": "44",
     "type":"Analytics"
 }, {
     "pattern": "\\.addthis\\.com\\/js\\/widget\\.(js|php)",
     "name": "AddThis",
     "id": "1049",
     "type":"Analytics"
 }, {
     "pattern": "l\\.addthiscdn\\.com",
     "name": "AddThis",
     "id": "1050",
     "type":"Analytics"
 }, {
     "pattern": "\\.revsci\\.net\\/",
     "name": "Revenue Science",
     "id": "45",
     "type":"Tracker"
 }, {
     "pattern": "wunderloop\\.net\\/",
     "name": "Revenue Science",
     "id": "1051",
     "type":"Tracker"
 }, {
     "pattern": "ad\\.targetingmarketplace\\.com\\/",
     "name": "Revenue Science",
     "id": "1052",
     "type":"Tracker"
 }, {
     "pattern": "revsci\\.(.*)\\/gw\\.js",
     "name": "Revenue Science",
     "id": "1053",
     "type":"Tracker"
 }, {
     "pattern": "(ads|clients|container)\\.pointroll\\.com",
     "name": "PointRoll",
     "id": "46"
 }, {
     "pattern": "\\/chartbeat\\.js",
     "name": "ChartBeat",
     "id": "47",
     "type":"Analytics"
 }, {
     "pattern": "\\.uservoice\\.com\\/",
     "name": "UserVoice",
     "id": "49",
     "type":"Widget"
 }, {
     "pattern": "(pixel|optimized-by|tap-cdn)\\.rubiconproject\\.com\\/",
     "name": "Rubicon",
     "id": "50",
     "type":"Ads"
 }, {
     "pattern": "www\\.conversionruler\\.com\\/bin\\/js\\.php",
     "name": "ConversionRuler",
     "id": "51"
 }, {
     "pattern": "lct\\.salesforce\\.com\\/sfga\\.js",
     "name": "Salesforce",
     "id": "52"
 }, {
     "pattern": "\\.(sphere|surphace)\\.com\\/widgets\\/sphereit\\/js",
     "name": "Sphere",
     "id": "53"
 }, {
     "pattern": "widget\\.criteo\\.com",
     "name": "Criteo",
     "id": "54"
 }, {
     "pattern": "dis(.*)?\\.criteo\\.com",
     "name": "Criteo",
     "id": "1054"
 }, {
     "pattern": "(social\\.bidsystem\\.com\\/|cubics\\.com\\/displayAd\\.js)",
     "name": "Cubics",
     "id": "55"
 }, {
     "pattern": "resources\\.infolinks\\.com\\/js\\/infolinks_main\\.js",
     "name": "InfoLinks",
     "id": "56"
 }, {
     "pattern": "ads(1)?\\.msn\\.com\\/library\\/dap\\.js",
     "name": "MSN Ads",
     "id": "58",
     "type":"Ads"
 }, {
     "pattern": "adsyndication\\.msn\\.com\\/delivery\\/getads\\.js",
     "name": "MSN Ads",
     "id": "1055",
     "type":"Ads"
 }, {
     "pattern": "widgets\\.outbrain\\.com\\/",
     "name": "Outbrain",
     "id": "59"
 }, {
     "pattern": "www\\.google\\.com\\/friendconnect\\/script\\/friendconnect\\.js",
     "name": "Google FriendConnect",
     "id": "60",
     "type":"Widget"
 }, {
     "pattern": "www\\.google\\.com\\/coop\\/cse\\/brand",
     "name": "Google Custom Search Engine",
     "id": "64"
 }, {
     "pattern": "www\\.google\\.com\\/uds\\/api\\?",
     "name": "Google AJAX Search API",
     "id": "65"
 }, {
     "pattern": "kona\\.kontera\\.com\\/javascript\\/",
     "name": "Kontera ContentLink",
     "id": "66"
 }, {
     "pattern": "\\.adbrite\\.com\\/",
     "name": "AdBrite",
     "id": "67"
 }, {
     "pattern": "(\\.adultadworld\\.com\\/geopop\\/geoinject\\.js|\\.adultadworld\\.com\\/jsc\\/)",
     "name": "AdultAdWorld",
     "id": "68"
 }, {
     "pattern": "\\.gunggo\\.com\\/show_ad\\.ashx",
     "name": "Gunggo",
     "id": "69"
 }, {
     "pattern": "doublepimp\\.com\\/getad\\.js",
     "name": "DoublePimp",
     "id": "70"
 }, {
     "pattern": "ads\\.sexinyourcity\\.com\\/",
     "name": "SexInYourCity",
     "id": "71",
     "type":"Ads"
 }, {
     "pattern": "ads\\.(lzjl|clicksor)\\.com",
     "name": "Clicksor",
     "id": "72",
     "type":"Ads"
 }, {
     "pattern": "static\\.hubspot\\.com\\/websiteGraderBadge\\/badge\\.js",
     "name": "HubSpot WebsiteGrader",
     "id": "73"
 }, {
     "pattern": "(js\\.adsonar\\.com\\/js\\/|ads\\.adsonar\\.com\\/adserving\\/)",
     "name": "Quigo AdSonar",
     "id": "74",
     "type":"Ads"
 }, {
     "pattern": "www\\.blogcatalog\\.com\\/w\\/recent\\.php",
     "name": "BlogCatalog",
     "id": "75"
 }, {
     "pattern": "\\.technorati\\.com\\/",
     "name": "Technorati Widget",
     "id": "76"
 }, {
     "pattern": "xslt\\.alexa\\.com\\/site_stats\\/js\\/t\\/",
     "name": "Alexa Traffic Rank",
     "id": "77"
 }, {
     "pattern": "(\\.tribalfusion\\.com\\/|tags\\.expo9\\.exponential\\.com\\/tags\\/)",
     "name": "Tribal Fusion",
     "id": "78"
 }, {
     "pattern": "disqus\\.com\\/forums\\/",
     "name": "Disqus",
     "id": "79"
 }, {
     "pattern": "mediacdn\\.disqus\\.com",
     "name": "Disqus",
     "id": "977"
 }, {
     "pattern": "ads\\.sixapart\\.com\\/",
     "name": "Six Apart Advertising",
     "id": "80",
     "type":"Ads"
 }, {
     "pattern": "ads\\.blogherads\\.com\\/",
     "name": "BlogHer Ads",
     "id": "81",
     "type":"Ads"
 }, {
     "pattern": "o\\.aolcdn\\.com\\/ads\\/adswrapper",
     "name": "Advertising.com",
     "id": "82",
     "type":"Ads"
 }, {
     "pattern": "o\\.aolcdn\\.com\\/js\\/mg2\\.js",
     "name": "Advertising.com",
     "id": "1056"
 }, {
     "pattern": "(r1\\.ace|ace-tag|servedby|uac)\\.advertising\\.com",
     "name": "Advertising.com",
     "id": "1057"
 }, {
     "pattern": "\\.atwola\\.com\\/",
     "name": "Advertising.com",
     "id": "1058"
 }, {
     "pattern": "leadback\\.advertising\\.com\\/adcedge\\/lb",
     "name": "LeadBack",
     "id": "83"
 }, {
     "pattern": "\\.doubleclick\\.net\\/activity;",
     "name": "DoubleClick Spotlight",
     "id": "85",
     "type":"Ads"
 }, {
     "pattern": "\\.overture\\.com\\/(partner\\/)?js",
     "name": "Yahoo! Overture",
     "id": "86"
 }, {
     "pattern": "perf\\.overture\\.com",
     "name": "Yahoo! Overture",
     "id": "938"
 }, {
     "pattern": "(www\\.)?intensedebate\\.com\\/js\\/",
     "name": "Intense Debate",
     "id": "87"
 }, {
     "pattern": "facebook\\.com\\/connect",
     "name": "Facebook Connect",
     "id": "1026",
     "type":"Widget"
 }, {
     "pattern": "connect\\.facebook\\.net",
     "name": "Facebook Connect",
     "id": "1027",
     "type":"Widget"
 }, {
     "pattern": "static\\.ak\\.connect\\.facebook\\.com\\/.*\\.js\\.php",
     "name": "Facebook Connect",
     "id": "1028",
     "type":"Widget"
 }, {
     "pattern": "\\/fbconnect\\.js",
     "name": "Facebook Connect",
     "id": "1029",
     "type":"Widget"
 }, {
     "pattern": "(static\\.btbuckets\\.com\\/bt\\.js|\\.n\\.btbuckets\\.com\\/js)",
     "name": "BTBuckets",
     "id": "89"
 }, {
     "pattern": "(cdn|g2|gonzogrape)\\.gumgum\\.com\\/javascripts\\/ggv2\\.js",
     "name": "gumgum",
     "id": "90"
 }, {
     "pattern": "hook\\.yieldbuild\\.com\\/s_ad\\.js",
     "name": "YieldBuild",
     "id": "91"
 }, {
     "pattern": "d\\.yimg\\.com\\/ds\\/badge\\.js",
     "name": "Yahoo! Buzz",
     "id": "92"
 }, {
     "pattern": "baynote(-observer)?([0-9]+)?\\.js",
     "name": "Baynote Observer",
     "id": "93"
 }, {
     "pattern": "baynote\\.net",
     "name": "Baynote Observer",
     "id": "1059"
 }, {
     "pattern": "triggit\\.com\\/tool\\/javascripts\\/trg_bs\\.js",
     "name": "TriggIt",
     "id": "94"
 }, {
     "pattern": "digg\\.com\\/tools\\/widgetjs",
     "name": "Digg Widget",
     "id": "95",
     "type":"Widget"
 }, {
     "pattern": "widgets\\.digg\\.com",
     "name": "Digg Widget",
     "id": "978",
     "type":"Widget"
 }, {
     "pattern": "cache\\.blogads\\.com\\/",
     "name": "Blogads",
     "id": "96",
     "type":"Ads"
 }, {
     "pattern": "\\.zedo\\.com\\/",
     "name": "Zedo",
     "id": "97"
 }, {
     "pattern": "\\.intellitxt\\.com",
     "name": "Vibrant Ads",
     "id": "98",
     "type":"Ads"
 }, {
     "pattern": "s3\\.amazonaws\\.com\\/getsatisfaction\\.com\\/(feedback\\/feedback\\.js|javascripts\\/feedback-v2\\.js)",
     "name": "GetSatisfaction",
     "id": "99"
 }, {
     "pattern": "\\.afy11\\.net\\/",
     "name": "Adify",
     "id": "100"
 }, {
     "pattern": "server\\.iad\\.liveperson\\.net\\/",
     "name": "LivePerson",
     "id": "102"
 }, {
     "pattern": "\\/k_(push|button)\\.js",
     "name": "Kampyle",
     "id": "103"
 }, {
     "pattern": "\\.clicktale\\.net\\/",
     "name": "ClickTale",
     "id": "104"
 }, {
     "pattern": "clicktale\\.pantherssl\\.com",
     "name": "ClickTale",
     "id": "1012"
 }, {
     "pattern": "\\.crwdcntrl\\.net\\/",
     "name": "Lotame",
     "id": "105"
 }, {
     "pattern": "adserving\\.cpxinteractive\\.com\\/",
     "name": "CPX Interactive",
     "id": "106",
     "type":"Ads"
 }, {
     "pattern": "adserving\\.cpxadroit\\.com",
     "name": "CPX Interactive",
     "id": "1000",
     "type":"Ads"
 }, {
     "pattern": "lypn\\.com\\/lp\\/",
     "name": "Lynchpin Analytics",
     "id": "107",
     "type":"Analytics"
 }, {
     "pattern": "revelations\\.trovus\\.co\\.uk\\/tracker\\/",
     "name": "Trovus Revelations",
     "id": "108"
 }, {
     "pattern": "touchclarity",
     "name": "Omniture TouchClarity",
     "id": "109"
 }, {
     "pattern": "\\.insightexpressai\\.com\\/",
     "name": "InsightExpress",
     "id": "110"
 }, {
     "pattern": "\\.kanoodle\\.com\\/",
     "name": "Kanoodle",
     "id": "111"
 }, {
     "pattern": "(tags\\.bluekai\\.com\\/|bkrtx\\.com\\/js\\/)",
     "name": "BlueKai",
     "id": "112",
     "type":"Ads"
 }, {
     "pattern": "(tr-metrics\\.loomia\\.com|assets\\.loomia\\.com\\/js\\/)",
     "name": "Loomia",
     "id": "113"
 }, {
     "pattern": "othersonline\\.com\\/*\\/[a-z0-9]+\\.js",
     "name": "Others Online",
     "id": "114"
 }, {
     "pattern": "twittercounter\\.com",
     "name": "TwitterCounter",
     "id": "115",
     "type":"Widget"
 }, {
     "pattern": "(\\.dtmpub\\.com\\/|login\\.dotomi\\.com\\/ucm\\/ucmcontroller)",
     "name": "Dotomi",
     "id": "117"
 }, {
     "pattern": "scripts\\.chitika\\.net\\/",
     "name": "Chitika",
     "id": "118"
 }, {
     "pattern": "ad\\.spot200\\.com\\/",
     "name": "Spot200",
     "id": "119"
 }, {
     "pattern": "\\.hitslink\\.com\\/",
     "name": "HitsLink",
     "id": "120"
 }, {
     "pattern": "\\.w3counter\\.com",
     "name": "W3Counter",
     "id": "121"
 }, {
     "pattern": "awstats_misc_tracker\\.js",
     "name": "AWStats",
     "id": "122"
 }, {
     "pattern": "stat\\.onestat\\.com\\/",
     "name": "OneStat",
     "id": "123"
 }, {
     "pattern": "\\.bmmetrix\\.com\\/",
     "name": "Bluemetrix",
     "id": "126"
 }, {
     "pattern": "include\\.reinvigorate\\.net\\/",
     "name": "Reinvigorate",
     "id": "127"
 }, {
     "pattern": "api\\.postrank\\.com\\/",
     "name": "PostRank",
     "id": "128"
 }, {
     "pattern": "service\\.collarity\\.com\\/",
     "name": "Collarity",
     "id": "129"
 }, {
     "pattern": "\\.smrtlnks\\.com\\/",
     "name": "AdaptiveBlue SmartLinks",
     "id": "130"
 }, {
     "pattern": "www\\.tumblr\\.com\\/dashboard\\/iframe",
     "name": "Tumblr",
     "id": "131"
 }, {
     "pattern": "blogrollr\\.com\\/embed\\.js",
     "name": "BlogRollr",
     "id": "132"
 }, {
     "pattern": "\\.casalemedia\\.com\\/",
     "name": "Casale Media",
     "id": "133"
 }, {
     "pattern": "track\\.blogcounter\\.de\\/",
     "name": "BlogCounter",
     "id": "134"
 }, {
     "pattern": "api\\.widgetbucks\\.com\\/script\\/ads\\.js",
     "name": "WidgetBucks",
     "id": "135",
     "type":"Ads"
 }, {
     "pattern": "www\\.nooked\\.com\\/javascripts\\/clearspring\\.js",
     "name": "Nooked",
     "id": "136"
 }, {
     "pattern": "(\\.mediaplex\\.com|\\.fastclick\\.net)\\/",
     "name": "ValueClick Mediaplex",
     "id": "137"
 }, {
     "pattern": "(www\\.haloscan\\.com\\/load\\/|js-kit\\.com\\/[0-9a-z\\/]+\\.js)",
     "name": "JS-Kit",
     "id": "138"
 }, {
     "pattern": "buzzster\\.com\\/widget\\/",
     "name": "Buzzster",
     "id": "139"
 }, {
     "pattern": "(trackalyzer\\.com|formalyzer\\.com)",
     "name": "LeadLander",
     "id": "140"
 }, {
     "pattern": "(\\.burstbeacon\\.com\\/|\\.burstnet\\.com\\/)",
     "name": "Burst Media",
     "id": "141"
 }, {
     "pattern": "\\.metricsdirect\\.com\\/",
     "name": "Zango",
     "id": "142"
 }, {
     "pattern": "(bspixel\\.bidsystem\\.com\\/|bidsystem\\.adknowledge\\.com\\/)",
     "name": "Adknowledge",
     "id": "143"
 }, {
     "pattern": "\\.nebuadserving\\.com\\/",
     "name": "NebuAd",
     "id": "144",
     "type":"Ads"
 }, {
     "pattern": "\\.media6degrees\\.com\\/",
     "name": "Media6Degrees",
     "id": "145"
 }, {
     "pattern": "\\/functionalTrends\\.js",
     "name": "FunctionalTrends",
     "id": "146"
 }, {
     "pattern": "\\.nuconomy\\.com\\/n\\.js",
     "name": "Nuconomy",
     "id": "147"
 }, {
     "pattern": "(\\.adrevolver\\.com|ads\\.bluelithium\\.com)\\/",
     "name": "Bluelithium",
     "id": "148",
     "type":"Ads"
 }, {
     "pattern": "\\.glam\\.com\\/app\\/site\\/affiliate\\/viewChannelModule\\.act",
     "name": "Glam Media",
     "id": "149"
 }, {
     "pattern": "storage\\.trafic\\.ro\\/js\\/trafic\\.js",
     "name": "Trafic",
     "id": "150"
 }, {
     "pattern": "\\.clicktracks\\.com\\/",
     "name": "Lyris ClickTracks",
     "id": "151"
 }, {
     "pattern": "\\.enquisite\\.com\\/log\\.js",
     "name": "Enquisite",
     "id": "152"
 }, {
     "pattern": "\\.extreme-dm\\.com\\/",
     "name": "eXTReMe Tracker",
     "id": "153"
 }, {
     "pattern": "\\.sweepery\\.com\\/javascripts\\/*\\/[0-9a-zA-Z_]*\\.js",
     "name": "Sweepery",
     "id": "155"
 }, {
     "pattern": "stat\\.netmonitor\\.fi\\/js\\/",
     "name": "NetMonitor",
     "id": "158"
 }, {
     "pattern": "munchkin\\.marketo\\.net\\/",
     "name": "Marketo",
     "id": "159"
 }, {
     "pattern": "(api|leads)\\.demandbase\\.com\\/",
     "name": "Demandbase",
     "id": "160",
     "type":"Ads"
 }, {
     "pattern": "pixel\\.fetchback\\.com\\/",
     "name": "Fetchback",
     "id": "161"
 }, {
     "pattern": "gw-services\\.vtrenz\\.net\\/",
     "name": "Silverpop",
     "id": "162"
 }, {
     "pattern": "(\\/eluminate\\.js|data\\.cmcore\\.com\\/imp|data\\.coremetrics\\.com)",
     "name": "Coremetrics",
     "id": "163"
 }, {
     "pattern": "www\\.dialogmgr\\.com\\/tag\\/lib\\.js",
     "name": "Magnify360",
     "id": "164"
 }, {
     "pattern": "tracking\\.fathomseo\\.com\\/",
     "name": "Fathom SEO",
     "id": "165"
 }, {
     "pattern": "(now\\.eloqua\\.com|elqcfg(xml)?\\.js|elqimg\\.js)",
     "name": "Eloqua",
     "id": "166"
 }, {
     "pattern": "\\.imiclk\\.com\\/",
     "name": "Acerno",
     "id": "167"
 }, {
     "pattern": "\\.mmismm\\.com\\/",
     "name": "Mindset Media",
     "id": "168"
 }, {
     "pattern": "rt\\.trafficfacts\\.com\\/",
     "name": "GoDaddy Site Analytics",
     "id": "169",
     "type":"Analytics"
 }, {
     "pattern": "\\.adnxs\\.com\\/",
     "name": "AdNexus",
     "id": "170"
 }, {
     "pattern": "\\.pro-market\\.net\\/",
     "name": "AlmondNet",
     "id": "171"
 }, {
     "pattern": "\\.exelator\\.com\\/",
     "name": "eXelate",
     "id": "173"
 }, {
     "pattern": "\\.fimserve\\.com\\/",
     "name": "Fox Audience Network",
     "id": "174"
 }, {
     "pattern": "\\.interclick\\.com\\/",
     "name": "interclick",
     "id": "175"
 }, {
     "pattern": "\\.nexac\\.com\\/",
     "name": "NextAction",
     "id": "176"
 }, {
     "pattern": "\\.trafficmp\\.com\\/",
     "name": "Epic Marketplace",
     "id": "177"
 }, {
     "pattern": "\\.turn\\.com\\/",
     "name": "Turn",
     "id": "178"
 }, {
     "pattern": "(\\.realmedia\\.com\\/|realmedia\\/ads\\/|\\.247realmedia\\.com\\/realmedia\\/ads\\/)",
     "name": "24/7 Real Media",
     "id": "179",
     "type":"Ads"
 }, {
     "pattern": "(\\.bizographics\\.com\\/|ad\\.bizo\\.com\\/pixel)",
     "name": "Bizo",
     "id": "182"
 }, {
     "pattern": "assets\\.skribit\\.com\\/javascripts\\/SkribitSuggest\\.js",
     "name": "Skribit",
     "id": "63"
 }, {
     "pattern": "\\.specificclick\\.net\\/",
     "name": "SpecificClick",
     "id": "61"
 }, {
     "pattern": "(\\.atdmt\\.com\\/|\\.adbureau\\.net\\/)",
     "name": "Microsoft Atlas",
     "id": "62",
     "type":"Ads"
 }, {
     "pattern": "code\\.etracker\\.com\\/",
     "name": "etracker",
     "id": "180"
 }, {
     "pattern": "\\.etracker\\.de\\/",
     "name": "etracker",
     "id": "1078"
 }, {
     "pattern": "\\.(scoreresearch|securestudies|scorecardresearch)\\.com\\/",
     "name": "Comscore Beacon",
     "id": "181",
     "type":"Sharing"
 }, {
     "pattern": "\\.snoobi\\.com\\/snoop\\.php",
     "name": "Snoobi",
     "id": "183"
 }, {
     "pattern": "\\.rfihub\\.com\\/",
     "name": "Rocket Fuel",
     "id": "184"
 }, {
     "pattern": "\\.shinystat\\.(com|it)\\/",
     "name": "ShinyStat",
     "id": "185"
 }, {
     "pattern": "(sniff|stats)\\.visistat\\.com\\/",
     "name": "VisiStat",
     "id": "186"
 }, {
     "pattern": "\\.sitestat\\.com\\/",
     "name": "NedStat",
     "id": "187"
 }, {
     "pattern": "(\\.tynt\\.com\\/ti\\.js|\\.tynt\\.com\\/javascripts\\/tracer\\.js)",
     "name": "Tynt Insight",
     "id": "188"
 }, {
     "pattern": "\\.i-stats\\.com\\/js\\/icounter\\.js",
     "name": "i-stats",
     "id": "189"
 }, {
     "pattern": "digg\\.com\\/[0-9a-zA-Z]*\\/diggthis\\.js",
     "name": "DiggThis",
     "id": "84"
 }, {
     "pattern": "\\.collective-media\\.net\\/",
     "name": "Collective Media",
     "id": "172"
 }, {
     "pattern": "\\.socialtwist\\.com",
     "name": "Tell-a-Friend",
     "id": "156",
     "type":"Widget"
 }, {
     "pattern": "tracking\\.summitmedia\\.co\\.uk\\/js\\/",
     "name": "Summit Media",
     "id": "190"
 }, {
     "pattern": "facebook\\.com\\/beacon\\/",
     "name": "Facebook Beacon",
     "id": "14",
     "type":"Widget"
 }, {
     "pattern": "(tracking\\.percentmobile\\.com\\/|\\/percent_mobile\\.js)",
     "name": "PercentMobile",
     "id": "157"
 }, {
     "pattern": "\\.yandex\\.ru\\/(resource|metrika)\\/watch\\.js",
     "name": "Yandex.Metrics",
     "id": "191"
 }, {
     "pattern": "yandex\\.ru\\/cycounter",
     "name": "Yandex.Metrics",
     "id": "882"
 }, {
     "pattern": "ad\\.adriver\\.ru\\/",
     "name": "AdRiver",
     "id": "192"
 }, {
     "pattern": "\\.spylog\\.(com|ru)\\/",
     "name": "Openstat",
     "id": "193"
 }, {
     "pattern": "\\/phpmyvisites\\.js",
     "name": "phpMyVisites",
     "id": "199"
 }, {
     "pattern": "\\.alexametrics\\.com\\/",
     "name": "Alexa Metrics",
     "id": "197"
 }, {
     "pattern": "\\.zemanta\\.com\\/",
     "name": "Zemanta",
     "id": "196"
 }, {
     "pattern": "\\.conversiondashboard\\.com\\/",
     "name": "ClickFuel",
     "id": "194"
 }, {
     "pattern": "vizisense\\.komli\\.net\\/pixel\\.js",
     "name": "ViziSense",
     "id": "198"
 }, {
     "pattern": "cdn\\.doubleverify\\.com\\/[0-9a-zA-Z_-]*\\.js",
     "name": "DoubleVerify",
     "id": "200"
 }, {
     "pattern": "one\\.statsit\\.com\\/",
     "name": "Statsit",
     "id": "201"
 }, {
     "pattern": "\\.leadforce1\\.com\\/bf\\/bf\\.js",
     "name": "LeadForce1",
     "id": "202"
 }, {
     "pattern": "\\.iperceptions\\.com\\/",
     "name": "iPerceptions",
     "id": "204"
 }, {
     "pattern": "\\.searchforce\\.net\\/",
     "name": "SearchForce",
     "id": "205"
 }, {
     "pattern": "\\.zendesk\\.com\\/external\\/zenbox\\/overlay\\.js",
     "name": "Zendesk",
     "id": "208"
 }, {
     "pattern": "\\.ivwbox\\.de\\/",
     "name": "INFOnline",
     "id": "209",
     "type":"Analytics"
 }, {
     "pattern": "(media|recs).richrelevance\\.com\\/",
     "name": "RichRelevance",
     "id": "210"
 }, {
     "pattern": "\\.google-analytics\\.com\\/siteopt\\.js",
     "name": "Google Website Optimizer",
     "id": "218",
     "type":"Sharing"
 }, {
     "pattern": "lt\\.navegg\\.com\\/lt\\.js",
     "name": "Navegg",
     "id": "219"
 }, {
     "pattern": "\\.adtegrity\\.net\\/",
     "name": "Adtegrity",
     "id": "224"
 }, {
     "pattern": "widgets\\.backtype\\.com\\/",
     "name": "BackType Widgets",
     "id": "203"
 }, {
     "pattern": "\\.blvdstatus\\.com\\/js\\/initBlvdJS\\.php",
     "name": "BLVD Status",
     "id": "213"
 }, {
     "pattern": "widgets\\.clearspring\\.com\\/",
     "name": "ClearSpring",
     "id": "217"
 }, {
     "pattern": "\\.clixmetrix\\.com\\/",
     "name": "ClixMetrix",
     "id": "228"
 }, {
     "pattern": "clixpy\\.com\\/clixpy\\.js",
     "name": "Clixpy",
     "id": "214"
 }, {
     "pattern": "rover\\.ebay\\.com\\/",
     "name": "eBay Stats",
     "id": "226"
 }, {
     "pattern": "\\.rsvpgenius\\.com\\/",
     "name": "Genius",
     "id": "220"
 }, {
     "pattern": "\\.kissmetrics\\.com\\/",
     "name": "KissMetrics",
     "id": "222"
 }, {
     "pattern": "doug1izaerwt3\\.cloudfront\\.net",
     "name": "KissMetrics",
     "id": "941"
 }, {
     "pattern": "\\/liveball_api\\.js",
     "name": "LiveBall",
     "id": "229"
 }, {
     "pattern": "counter\\.yadro\\.ru\\/",
     "name": "LiveInternet",
     "id": "211",
     "type":"Widget"
 }, {
     "pattern": "logdy\\.com\\/scripts\\/script\\.js",
     "name": "Logdy",
     "id": "215"
 }, {
     "pattern": "\\.marinsm\\.com\\/",
     "name": "Marin Search Marketer",
     "id": "230"
 }, {
     "pattern": "api\\.mixpanel\\.com\\/",
     "name": "MixPanel",
     "id": "223"
 }, {
     "pattern": "(cid|pi)\\.pardot\\.com\\/",
     "name": "Pardot",
     "id": "231"
 }, {
     "pattern": "(spruce\\.rapleaf\\.com|\\.rlcdn\\.com)",
     "name": "RapLeaf",
     "id": "195"
 }, {
     "pattern": "\\.inq\\.com\\/",
     "name": "TouchCommerce",
     "id": "227"
 }, {
     "pattern": "tweetboard\\.com\\/tb\\.js",
     "name": "Tweetboard",
     "id": "206"
 }, {
     "pattern": "(tweetmeme\\.com\\/i\\/scripts\\/button\\.js|zulu\\.tweetmeme\\.com\\/button_ajax\\.js)",
     "name": "TweetMeme",
     "id": "207"
 }, {
     "pattern": "(\\.unica\\.com\\/|ntpagetag)",
     "name": "Unica",
     "id": "225"
 }, {
     "pattern": "vistrac\\.com\\/static\\/vt\\.js",
     "name": "vistrac",
     "id": "212"
 }, {
     "pattern": "widgetserver\\.com\\/syndication\\/subscriber",
     "name": "WidgetBox",
     "id": "216"
 }, {
     "pattern": "tracker\\.wordstream\\.com\\/",
     "name": "WordStream",
     "id": "221"
 }, {
     "pattern": "js\\.stormiq\\.com/sid[0-9]*_[0-9]*\\.[0-9]*\\.js",
     "name": "DC StormIQ",
     "id": "447"
 }, {
     "pattern": "\\.histats\\.com\\/",
     "name": "Histats",
     "id": "448"
 }, {
     "pattern": "(widgets\\.amung\\.us\\/.*\\.js|whos\\.amung\\.us\\/widget\\/)",
     "name": "Whos.amung.us",
     "id": "449"
 }, {
     "pattern": "data\\.gosquared\\.com",
     "name": "GoSquared LiveStats",
     "id": "450"
 }, {
     "pattern": "d1l6p2sc9645hc\\.cloudfront\\.net",
     "name": "GoSquared LiveStats",
     "id": "1015"
 }, {
     "pattern": "www\\.apture\\.com\\/js\\/apture\\.js",
     "name": "Apture",
     "id": "451"
 }, {
     "pattern": "c\\.compete\\.com\\/bootstrap\\/.*\\/bootstrap\\.js",
     "name": "CompeteXL",
     "id": "453"
 }, {
     "pattern": "pixel\\.33across\\.com",
     "name": "33Across",
     "id": "498"
 }, {
     "pattern": "(s3\\.amazonaws\\.com\\/wingify\\/vis_opt\\.js|dev\\.visualwebsiteoptimizer\\.com\\/deploy\\/js_visitor_settings\\.php.*|server\\.wingify\\.com\\/app\\/js\\/code\\/wg_consolidated\\.js)",
     "name": "Visual Website Optimizer",
     "id": "455"
 }, {
     "pattern": "d5phz18u4wuww\\.cloudfront\\.net",
     "name": "Visual Website Optimizer",
     "id": "1098"
 }, {
     "pattern": "mashlogic\\.com\\/(loader\\.min\\.js|brands\\/embed\\/)",
     "name": "MashLogic",
     "id": "457"
 }, {
     "pattern": "s3\\.buysellads\\.com",
     "name": "BuySellAds",
     "id": "458",
     "type":"Ads"
 }, {
     "pattern": "cim\\.meebo\\.com\\/cim",
     "name": "Meebo Bar",
     "id": "459"
 }, {
     "pattern": "(c1|beta)\\.web-visor\\.com\\/c\\.js",
     "name": "WebVisor",
     "id": "460"
 }, {
     "pattern": "stags\\.peer39\\.net\\/",
     "name": "Peer39",
     "id": "461"
 }, {
     "pattern": "\\.eproof\\.com\\/js\\/.*\\.js",
     "name": "eProof",
     "id": "462"
 }, {
     "pattern": "(autocontext|o)\\.begun\\.ru\\/",
     "name": "Begun",
     "id": "463"
 }, {
     "pattern": "foresee-(trigger(.*)?|alive|analytics(.*)?)\\.js",
     "name": "ForeSee",
     "id": "464",
     "type":"Analytics"
 }, {
     "pattern": "\\.quintelligence\\.com\\/quint\\.js",
     "name": "Quintelligence",
     "id": "465"
 }, {
     "pattern": "3dstats\\.com\\/cgi-bin\\/3dstrack(ssl)?\\.cgi",
     "name": "3DStats",
     "id": "466"
 }, {
     "pattern": "addfreestats\\.com\\/cgi-bin\\/afstrack\\.cgi",
     "name": "AddFreeStats",
     "id": "467"
 }, {
     "pattern": "(\\.webtrekk\\.net|\\/webtrekk\\.js)",
     "name": "Webtrekk",
     "id": "468"
 }, {
     "pattern": "channelintelligence\\.com\\/",
     "name": "Channel Intelligence",
     "id": "470"
 }, {
     "pattern": "ads\\.doclix\\.com\\/adserver\\/serve\\/",
     "name": "AdSide",
     "id": "471",
     "type":"Ads"
 }, {
     "pattern": "bdv\\.bidvertiser\\.com\\/",
     "name": "BidVertiser",
     "id": "472"
 }, {
     "pattern": "view\\.binlayer\\.com\\/ad",
     "name": "BinLayer",
     "id": "473"
 }, {
     "pattern": "get\\.mirando\\.de\\/",
     "name": "Mirando",
     "id": "474"
 }, {
     "pattern": "ads\\.adtiger\\.de\\/",
     "name": "AdTiger",
     "id": "475",
     "type":"Ads"
 }, {
     "pattern": "js\\.adscale\\.de\\/",
     "name": "AdScale",
     "id": "476"
 }, {
     "pattern": "(js|tag)\\.admeld\\.com",
     "name": "AdMeld",
     "id": "478"
 }, {
     "pattern": "dsa\\.csdata1\\.com",
     "name": "ClearSaleing",
     "id": "477"
 }, {
     "pattern": "cdn\\.wibiya\\.com\\/(toolbars|loaders)",
     "name": "Wibiya Toolbar",
     "id": "479"
 }, {
     "pattern": "\\/adam\\/(cm8[0-9a-z_]+\\.js|detect)",
     "name": "CheckM8",
     "id": "480"
 }, {
     "pattern": "www\\.actonsoftware\\.com\\/acton\\/bn\\/",
     "name": "Act-On Beacon",
     "id": "481"
 }, {
     "pattern": "(\\.res-x\\.com\\/ws\\/r2\\/resonance|\\/resxclsa\\.js)",
     "name": "Resonance",
     "id": "483"
 }, {
     "pattern": "(\\/gomez.+?\\.js|\\.[rt]\\.axf8\\.net\\/)",
     "name": "Gomez",
     "id": "484"
 }, {
     "pattern": "(cdn\\.mercent\\.com\\/js\\/tracker\\.js|link\\.mercent\\.com\\/)",
     "name": "Mercent",
     "id": "485"
 }, {
     "pattern": "(\\.content\\.ru4\\.com\\/images\\/|\\.edge\\.ru4\\.com\\/smartserve\\/|\\.xp1\\.ru4\\.com\\/|ad\\.xplusone\\.com\\/|\\/xplus1\\/xp1\\.js)",
     "name": "[x+1]",
     "id": "487"
 }, {
     "pattern": "www\\.googleadservices\\.com\\/pagead\\/conversion",
     "name": "Google AdWords Conversion",
     "id": "488",
     "type":"Ads"
 }, {
     "pattern": "s\\.clickability\\.com\\/s",
     "name": "Clickability Beacon",
     "id": "490"
 }, {
     "pattern": "(xslt\\.alexa\\.com\\/site_stats\\/js\\/s\\/|widgets\\.alexa\\.com\\/traffic\\/javascript\\/)",
     "name": "Alexa Widget",
     "id": "491"
 }, {
     "pattern": "ad\\.retargeter\\.com/seg",
     "name": "ReTargeter Beacon",
     "id": "492"
 }, {
     "pattern": "tags\\.mediaforge\\.com\\/if\\/[0-9]+",
     "name": "mediaFORGE",
     "id": "494"
 }, {
     "pattern": "\\.visualdna\\.com\\/",
     "name": "VisualDNA",
     "id": "496"
 }, {
     "pattern": "\\.visualdna-stats\\.com\\/",
     "name": "VisualDNA",
     "id": "1060"
 }, {
     "pattern": "tracking\\.searchmarketing\\.com\\/",
     "name": "ChannelAdvisor",
     "id": "499"
 }, {
     "pattern": "saas\\.intelligencefocus\\.com\\/sensor\\/",
     "name": "IntelligenceFocus",
     "id": "501"
 }, {
     "pattern": "www\\.domodomain\\.com\\/domodomain\\/sensor\\/",
     "name": "DomoDomain",
     "id": "502"
 }, {
     "pattern": "\\.optimost\\.com\\/",
     "name": "Optimost",
     "id": "504"
 }, {
     "pattern": "\\/(html|image|js)\\.ng\\/",
     "name": "DoubleClick DART",
     "id": "505",
     "type":"Ads"
 }, {
     "pattern": "t\\.p\\.mybuys\\.com\\/js\\/mybuys3\\.js",
     "name": "MyBuys",
     "id": "506"
 }, {
     "pattern": "track\\.roiservice\\.com\\/track\\/",
     "name": "Atlas ProfitBuilder",
     "id": "507"
 }, {
     "pattern": "(bh|tag|ds)\\.contextweb\\.com",
     "name": "ContextWeb",
     "id": "508"
 }, {
     "pattern": "\\.dmtracker\\.com\\/",
     "name": "DemandMedia",
     "id": "509"
 }, {
     "pattern": "cdn\\.triggertag\\.gorillanation\\.com\\/js\\/triggertag\\.js",
     "name": "Gorilla Nation",
     "id": "511"
 }, {
     "pattern": "nr7\\.us\\/apps\\/",
     "name": "Net-Results",
     "id": "512"
 }, {
     "pattern": "searchignite\\.com\\/si\\/cm\\/tracking\\/",
     "name": "SearchIgnite",
     "id": "514"
 }, {
     "pattern": "\\.wa\\.marketingsolutions\\.yahoo\\.com\\/script\\/scriptservlet",
     "name": "Yahoo Search Marketing Analytics",
     "id": "516",
     "type":"Sharing"
 }, {
     "pattern": "\\.doubleclick\\.net\\/activityi",
     "name": "DoubleClick Floodlight",
     "id": "517",
     "type":"Ads"
 }, {
     "pattern": "fls\\.doubleclick\\.net",
     "name": "DoubleClick Floodlight",
     "id": "965",
     "type":"Ads"
 }, {
     "pattern": "prof\\.estat\\.com\\/js\\/",
     "name": "eStat",
     "id": "518"
 }, {
     "pattern": "(adstat\\.4u\\.pl\\/s\\.js|stat\\.4u\\.pl\\/cgi-bin\\/)",
     "name": "stat4u",
     "id": "519"
 }, {
     "pattern": "\\.hit\\.gemius\\.pl",
     "name": "Gemius",
     "id": "520"
 }, {
     "pattern": "\\/xgemius\\.js",
     "name": "Gemius",
     "id": "1020"
 }, {
     "pattern": "jlinks\\.industrybrains\\.com\\/jsct",
     "name": "Adhere",
     "id": "521"
 }, {
     "pattern": "\\/z(i|a)g\\.(js|gif)",
     "name": "ZigZag",
     "id": "522"
 }, {
     "pattern": "bs\\.serving-sys\\.com\\/burstingpipe\\/(activityserver|adserver)\\.bs",
     "name": "MediaMind",
     "id": "523"
 }, {
     "pattern": "img\\.pulsemgr\\.com",
     "name": "Permuto",
     "id": "543"
 }, {
     "pattern": "segment-pixel\\.invitemedia\\.com",
     "name": "Invite Media",
     "id": "525"
 }, {
     "pattern": "assets\\.newsinc\\.com\\/(ndn\\.2\\.js|analyticsprovider\\.svc\\/)",
     "name": "NDN Analytics",
     "id": "526",
     "type":"Analytics"
 }, {
     "pattern": "\\.predictad\\.com\\/scripts\\/(molosky|publishers)\\/",
     "name": "PredictAd",
     "id": "527"
 }, {
     "pattern": "\\.netshelter\\.net",
     "name": "NetShelter",
     "id": "528"
 }, {
     "pattern": "\\.iesnare\\.com",
     "name": "ReputationManager",
     "id": "529"
 }, {
     "pattern": "\\.(brcdn|brsrvr)\\.com\\/",
     "name": "BloomReach",
     "id": "531"
 }, {
     "pattern": "(beacon|js)\\.clickequations\\.net",
     "name": "ClickEquations",
     "id": "532"
 }, {
     "pattern": "mct\\.rkdms\\.com\\/sid\\.gif",
     "name": "RKG Attribution Management",
     "id": "533"
 }, {
     "pattern": "server[2-4]\\.web-stat\\.com",
     "name": "Web-Stat",
     "id": "535"
 }, {
     "pattern": "\\/internal\\/jscript\\/dwanalytics\\.js",
     "name": "Demandware Analytics",
     "id": "537",
     "type":"Analytics"
 }, {
     "pattern": "a\\.giantrealm\\.com",
     "name": "Giant Realm",
     "id": "538"
 }, {
     "pattern": "tags\\.dashboardad\\.net",
     "name": "Dashboard Ad",
     "id": "540"
 }, {
     "pattern": "\\.oewabox\\.at",
     "name": "OWA",
     "id": "541"
 }, {
     "pattern": "\\.amgdgt\\.com\\/(ads|base)\\/",
     "name": "Adconion",
     "id": "542"
 }, {
     "pattern": "(ads|image2)\\.pubmatic\\.com\\/adserver\\/",
     "name": "PubMatic",
     "id": "544"
 }, {
     "pattern": "ad\\.fed\\.adecn\\.com",
     "name": "AdECN",
     "id": "546"
 }, {
     "pattern": "adelixir\\.com\\/(webpages\\/scripts\\/ne_roi_tracking\\.js|neroitrack)",
     "name": "LXR100",
     "id": "547"
 }, {
     "pattern": "keywordmax\\.com\\/tracking\\/",
     "name": "KeywordMax",
     "id": "548"
 }, {
     "pattern": "amadesa\\.com\\/static\\/client_js\\/engine\\/amadesajs\\.js",
     "name": "Amadesa",
     "id": "550"
 }, {
     "pattern": "\\.srtk\\.net\\/www\\/delivery\\/",
     "name": "SearchRev",
     "id": "551"
 }, {
     "pattern": "(tns-counter\\.ru|tns-counter\\.js|\\.tns-cs\\.net|statistik-gallup\\.net|\\.sesamestats\\.com)",
     "name": "TNS",
     "id": "552"
 }, {
     "pattern": "[a|c]\\.adroll\\.com",
     "name": "AdRoll",
     "id": "553"
 }, {
     "pattern": "hints\\.netflame\\.cc\\/service\\/script\\/",
     "name": "Fireclick",
     "id": "554"
 }, {
     "pattern": "\\.tynt\\.com\\/ts\\.js",
     "name": "Tynt SpeedSearch",
     "id": "555"
 }, {
     "pattern": "ad\\.xtendmedia\\.com",
     "name": "XTEND",
     "id": "556"
 }, {
     "pattern": "newstogram\\.com\\/(.*)\\/(histogram|toolbar)\\.js",
     "name": "Newstogram",
     "id": "558"
 }, {
     "pattern": "ad\\.adlegend\\.com",
     "name": "TruEffect",
     "id": "559"
 }, {
     "pattern": "a\\.mouseflow\\.com",
     "name": "Mouseflow",
     "id": "560"
 }, {
     "pattern": "(rotator\\.adjuggler\\.com|\\/banners\\/ajtg\\.js|\\/servlet\\/ajrotator\\/)",
     "name": "AdJuggler",
     "id": "561"
 }, {
     "pattern": "picadmedia\\.com\\/js\\/",
     "name": "Image Space Media",
     "id": "562"
 }, {
     "pattern": "(m|js|api|cdn)\\.viglink\\.com",
     "name": "VigLink",
     "id": "563"
 }, {
     "pattern": "sageanalyst\\.net",
     "name": "SageMetrics",
     "id": "565"
 }, {
     "pattern": "svlu\\.net",
     "name": "SeeVolution",
     "id": "566"
 }, {
     "pattern": "w55c\\.net",
     "name": "DataXu",
     "id": "567"
 }, {
     "pattern": "(cdn|crosspixel)\\.demdex\\.net",
     "name": "Demdex",
     "id": "569"
 }, {
     "pattern": "adserver\\.(adtechus\\.com|adtech\\.de)",
     "name": "ADTECH",
     "id": "570"
 }, {
     "pattern": "\\.r\\.msn\\.com\\/scripts\\/microsoft_adcenterconversion\\.js",
     "name": "Microsoft adCenter Conversion",
     "id": "571"
 }, {
     "pattern": "(dw|adlog)\\.com\\.com\\/",
     "name": "CBS Interactive",
     "id": "572"
 }, {
     "pattern": "netmng\\.com\\/",
     "name": "Netmining",
     "id": "573"
 }, {
     "pattern": "px\\.owneriq\\.net",
     "name": "OwnerIQ",
     "id": "574"
 }, {
     "pattern": "app\\.insightgrit\\.com\\/1\\/",
     "name": "Zeta Search",
     "id": "575"
 }, {
     "pattern": "ads\\.bridgetrack\\.com\\/",
     "name": "BridgeTrack",
     "id": "576"
 }, {
     "pattern": "\\.bridgetrack\\.com\\/track",
     "name": "BridgeTrack",
     "id": "920"
 }, {
     "pattern": "\\.bridgetrack\\.com\\/a\\/s\\/",
     "name": "BridgeTrack",
     "id": "921"
 }, {
     "pattern": "hits\\.convergetrack\\.com\\/",
     "name": "ConvergeTrack",
     "id": "578"
 }, {
     "pattern": "(\\.dt07\\.net|mg\\.dt00\\.net\\/(u)?js)",
     "name": "MarketGid",
     "id": "580"
 }, {
     "pattern": "(publishers|\\.hat)\\.halogennetwork\\.com\\/",
     "name": "Halogen Network",
     "id": "581"
 }, {
     "pattern": "app\\.phonalytics\\.com\\/track",
     "name": "Phonalytics",
     "id": "582"
 }, {
     "pattern": "cn\\.clickable\\.net\\/js\\/cct\\.js",
     "name": "Clickable",
     "id": "583"
 }, {
     "pattern": "s0b?\\.bluestreak\\.com\\/ix\\.e",
     "name": "BlueStreak",
     "id": "584"
 }, {
     "pattern": "tracking\\.dsmmadvantage\\.com\\/clients\\/",
     "name": "DSMM Advantage",
     "id": "585"
 }, {
     "pattern": "(cdn\\.nprove\\.com\\/npcore\\.js|go\\.cpmadvisors\\.com\\/)",
     "name": "XA.net",
     "id": "586"
 }, {
     "pattern": "\\.intermundomedia\\.com\\/",
     "name": "InterMundo Media",
     "id": "587"
 }, {
     "pattern": "vtracker\\.com\\/(counter|stats|tr\\.x|ts|tss|mvlive|digits)",
     "name": "MindViz Tracker",
     "id": "588"
 }, {
     "pattern": "(scripts|tm)\\.verticalacuity\\.com\\/vat\\/mon\\/vt\\.js",
     "name": "Vertical Acuity",
     "id": "590"
 }, {
     "pattern": "(impression|ca)\\.clickinc\\.com\\/",
     "name": "ClickInc",
     "id": "591"
 }, {
     "pattern": "\\.skimresources\\.com\\/js",
     "name": "SkimLinks",
     "id": "592"
 }, {
     "pattern": "\\.skimlinks\\.com\\/(api|js)\\/",
     "name": "SkimLinks",
     "id": "1032"
 }, {
     "pattern": "ad\\.metanetwork\\.com\\/",
     "name": "Meta Network",
     "id": "593"
 }, {
     "pattern": "rt\\.legolas-media\\.com\\/",
     "name": "Legolas Media",
     "id": "595"
 }, {
     "pattern": "cdn\\.krxd\\.net\\/krux\\.js",
     "name": "Krux Digital",
     "id": "597"
 }, {
     "pattern": "(clickserve\\.cc-dt\\.com\\/link\\/|gan\\.doubleclick\\.net\\/gan)",
     "name": "Google Affiliate Network",
     "id": "598",
     "type":"Ads"
 }, {
     "pattern": "\\.fwmrm\\.net\\/(ad|g)\\/",
     "name": "FreeWheel",
     "id": "599"
 }, {
     "pattern": "\\.ibpxl\\.com\\/",
     "name": "InternetBrands",
     "id": "602"
 }, {
     "pattern": "pmetrics\\.performancing\\.com\\/(js|in\\.php|[0-9]*\\.js)",
     "name": "Performancing Metrics",
     "id": "603"
 }, {
     "pattern": "(tracking\\.conversionlab\\.it|conversionlab\\.trackset\\.com\\/track\\/)",
     "name": "Trackset ConversionLab",
     "id": "604"
 }, {
     "pattern": "visualpath[0-9]\\.trackset\\.it\\/",
     "name": "Trackset VisualPath",
     "id": "605"
 }, {
     "pattern": "\\.adblade\\.com\\/",
     "name": "Adblade",
     "id": "606"
 }, {
     "pattern": "ads\\.undertone\\.com",
     "name": "Undertone Networks",
     "id": "608"
 }, {
     "pattern": "cdn\\.undertone\\.com\\/js\\/ajs\\.js",
     "name": "Undertone Networks",
     "id": "930"
 }, {
     "pattern": "ads\\.lucidmedia\\.com\\/clicksense\\/pixel",
     "name": "Lucid Media",
     "id": "610"
 }, {
     "pattern": "track\\.did-it\\.com\\/",
     "name": "Didit Maestro",
     "id": "612"
 }, {
     "pattern": "tag\\.didit\\.com\\/(didit|js)\\/",
     "name": "Didit Blizzard",
     "id": "613"
 }, {
     "pattern": "(content|track)\\.pulse360\\.com\\/",
     "name": "Pulse360",
     "id": "614"
 }, {
     "pattern": "\\.adgear\\.com\\/",
     "name": "AdGear",
     "id": "615"
 }, {
     "pattern": "j\\.clickdensity\\.com\\/cr\\.js",
     "name": "ClickDensity",
     "id": "616"
 }, {
     "pattern": "visitorville\\.com\\/js\\/plgtrafic\\.js\\.php",
     "name": "VisitorVille",
     "id": "618"
 }, {
     "pattern": "ads\\.affbuzzads\\.com\\/",
     "name": "AffiliateBuzz",
     "id": "619"
 }, {
     "pattern": "cts\\.vresp\\.com\\/s\\.gif",
     "name": "VerticalResponse",
     "id": "620"
 }, {
     "pattern": "\\.linksynergy\\.com",
     "name": "LinkShare",
     "id": "621",
     "type":"Widget"
 }, {
     "pattern": "websitealive[0-9]\\.com\\/",
     "name": "AliveChat",
     "id": "622"
 }, {
     "pattern": "b\\.monetate\\.net\\/js\\/",
     "name": "Monetate",
     "id": "624"
 }, {
     "pattern": "(adserver|int)\\.teracent\\.net\\/",
     "name": "Teracent",
     "id": "625"
 }, {
     "pattern": "html\\.aggregateknowledge\\.com\\/iframe",
     "name": "Aggregate Knowledge",
     "id": "627"
 }, {
     "pattern": "\\.tellapart\\.com\\/crumb",
     "name": "TellApart",
     "id": "629"
 }, {
     "pattern": "vitamine\\.networldmedia\\.net\\/bts\\/",
     "name": "BV! Media",
     "id": "630"
 }, {
     "pattern": "projectwonderful\\.com/(\\ad_display\\.js|gen\\.php)",
     "name": "Project Wonderful",
     "id": "632"
 }, {
     "pattern": "voicefive\\.com\\/.*\\.pli",
     "name": "VoiceFive",
     "id": "633"
 }, {
     "pattern": "(econda.*\\.js|www\\.econda-monitor\\.de\\/els\\/logging)",
     "name": "Econda",
     "id": "635"
 }, {
     "pattern": "adspeed\\.(com|net)\\/ad\\.php",
     "name": "AdSpeed",
     "id": "636"
 }, {
     "pattern": "live1\\.netupdater\\.info\\/live\\.php",
     "name": "NetUpdater",
     "id": "638"
 }, {
     "pattern": "netupdater[0-9]\\.de",
     "name": "NetUpdater",
     "id": "1061"
 }, {
     "pattern": "\\/netupdater(_live)?",
     "name": "NetUpdater",
     "id": "1062"
 }, {
     "pattern": "\\.ic-live\\.com\\/(goat\\.php|[0-9][0-9][0-9][0-9]\\.js)",
     "name": "iCrossing",
     "id": "639"
 }, {
     "pattern": "\\.sptag3\\.com",
     "name": "iCrossing",
     "id": "1145"
 }, {
     "pattern": "adreadytractions\\.com\\/rt\\/",
     "name": "AdReady",
     "id": "640"
 }, {
     "pattern": "(adcode|conv)\\.adengage\\.com",
     "name": "AdEngage",
     "id": "643"
 }, {
     "pattern": "server\\.cpmstar\\.com",
     "name": "CPMStar",
     "id": "645"
 }, {
     "pattern": "tracker\\.financialcontent\\.com\\/",
     "name": "Financial Content",
     "id": "647"
 }, {
     "pattern": "www\\.csm-secure\\.com\\/scripts\\/clicktracking\\.js",
     "name": "ClearSearch",
     "id": "648"
 }, {
     "pattern": "sitecompass\\.com\\/(sc_cap\\/|[ij]pixel)",
     "name": "Site Compass",
     "id": "649"
 }, {
     "pattern": "link\\.ixs1\\.net\\/s\\/at",
     "name": "eWayDirect",
     "id": "651"
 }, {
     "pattern": "upsellit\\.com\\/",
     "name": "UpSellit",
     "id": "652"
 }, {
     "pattern": "accelerator-media\\.com\\/pixel",
     "name": "Accelerator Media",
     "id": "653"
 }, {
     "pattern": "(haku|puma|cheetah)\\.vizu\\.com",
     "name": "Vizu",
     "id": "655"
 }, {
     "pattern": "\\.adfox\\.ru\\/preparecode",
     "name": "AdFox",
     "id": "657"
 }, {
     "pattern": "(goku\\.brightcove\\.com|admin\\.brightcove\\.com\\/js)",
     "name": "Brightcove",
     "id": "658"
 }, {
     "pattern": "ats\\.tumri\\.net",
     "name": "Tumri",
     "id": "698"
 }, {
     "pattern": "\\.mathtag\\.com",
     "name": "MediaMath",
     "id": "662"
 }, {
     "pattern": "(ad|ad2|counter)\\.rambler\\.ru",
     "name": "Rambler",
     "id": "664"
 }, {
     "pattern": "\\.mail\\.ru\\/counter",
     "name": "Rambler",
     "id": "1063"
 }, {
     "pattern": "\\.list\\.ru\\/counter",
     "name": "Rambler",
     "id": "1064"
 }, {
     "pattern": "lookup\\.bluecava\\.com",
     "name": "BlueCava",
     "id": "665"
 }, {
     "pattern": "monitus(_tools)?\\.js",
     "name": "Monitus",
     "id": "667"
 }, {
     "pattern": "(l|b)ive\\.monitus\\.net",
     "name": "Monitus",
     "id": "1065"
 }, {
     "pattern": "service\\.optify\\.net\\/",
     "name": "Optify",
     "id": "668"
 }, {
     "pattern": "ad\\.reduxmedia\\.com\\/",
     "name": "Redux Media",
     "id": "670"
 }, {
     "pattern": "(servedby|geo)\\.precisionclick\\.com\\/",
     "name": "PrecisionClick",
     "id": "672"
 }, {
     "pattern": "counters\\.gigya\\.com",
     "name": "Gigya Beacon",
     "id": "675"
 }, {
     "pattern": "\\.gigya\\.com\\/js\\/socialize\\.js",
     "name": "Gigya Beacon",
     "id": "1091"
 }, {
     "pattern": "webiqonline\\.com",
     "name": "Usability Sciences WebIQ",
     "id": "676"
 }, {
     "pattern": "radar\\.cedexis\\.(com|net)",
     "name": "Cedexis Radar",
     "id": "677"
 }, {
     "pattern": "as00\\.estara\\.com\\/as\\/initiatecall2\\.php",
     "name": "ATG Optimization",
     "id": "678"
 }, {
     "pattern": "\\.atgsvcs\\.com\\/js\\/atgsvcs\\.js",
     "name": "ATG Recommendations",
     "id": "679"
 }, {
     "pattern": "\\.mookie1\\.com",
     "name": "Media Innovation Group",
     "id": "680"
 }, {
     "pattern": "stats\\.businessol\\.com",
     "name": "BusinessOnLine Analytics",
     "id": "682",
     "type":"Analytics"
 }, {
     "pattern": "webtraxs\\.(js|com)",
     "name": "Web Traxs",
     "id": "683"
 }, {
     "pattern": "pixel\\.adbuyer\\.com",
     "name": "AdBuyer.com",
     "id": "684"
 }, {
     "pattern": "adadvisor\\.net",
     "name": "TargusInfo",
     "id": "686"
 }, {
     "pattern": "vertster.com\\/.*\\/vswap\\.js",
     "name": "Vertster",
     "id": "688"
 }, {
     "pattern": "voice2page\\.com\\/naa_1x1\\.js",
     "name": "InternetAudioAds",
     "id": "689"
 }, {
     "pattern": "ad\\.z5x\\.net",
     "name": "DSNR Media Group",
     "id": "690"
 }, {
     "pattern": "data\\.resultlinks\\.com",
     "name": "Result Links",
     "id": "692"
 }, {
     "pattern": "eyewonder\\.com\\/",
     "name": "EyeWonder",
     "id": "693"
 }, {
     "pattern": "ad(media)?\\.wsod\\.com",
     "name": "Wall Street on Demand",
     "id": "694"
 }, {
     "pattern": "\\.visiblemeasures\\.com\\/log",
     "name": "Visible Measures",
     "id": "699"
 }, {
     "pattern": "fx\\.gtop(stats\\.com|\\.ro)\\/js\\/gtop\\.js",
     "name": "GTop",
     "id": "701"
 }, {
     "pattern": "adsfac\\.(eu|us|sg|net)",
     "name": "Facilitate Digital",
     "id": "702"
 }, {
     "pattern": "pixazza\\.com\\/(static\\/)?widget",
     "name": "Pixazza",
     "id": "704"
 }, {
     "pattern": "(qnsr\\.com|thecounter\\.com\\/id)",
     "name": "Quinn Street",
     "id": "705"
 }, {
     "pattern": "(smp|leads)\\.specificmedia\\.com",
     "name": "Specific Media",
     "id": "707"
 }, {
     "pattern": "adviva\\.net",
     "name": "Specific Media",
     "id": "1031"
 }, {
     "pattern": "gmads\\.net",
     "name": "GroupM Server",
     "id": "709"
 }, {
     "pattern": "levexis\\.com",
     "name": "TagMan",
     "id": "711"
 }, {
     "pattern": "(mmcore\\.js|cg-global\\.maxymiser\\.com)",
     "name": "Maxymiser",
     "id": "713"
 }, {
     "pattern": "nexus\\.ensighten\\.com",
     "name": "Ensighten",
     "id": "714"
 }, {
     "pattern": "uptrends\\.com\\/(aspx\\/uptime\\.aspx|images\\/uptrends\\.gif)",
     "name": "Uptrends",
     "id": "715"
 }, {
     "pattern": "visitstreamer\\.com\\/vs\\.js",
     "name": "Visit Streamer",
     "id": "716"
 }, {
     "pattern": "crm-metrix\\.com",
     "name": "crmmetrix",
     "id": "717"
 }, {
     "pattern": "customerconversio\\.com",
     "name": "crmmetrix",
     "id": "1025"
 }, {
     "pattern": "utd\\.stratigent\\.com",
     "name": "Stratigent",
     "id": "718"
 }, {
     "pattern": "facebook\\.com\\/(plugins|widgets)\\/.*\\.php",
     "name": "Facebook Social Plugins",
     "id": "719",
     "type":"Widget"
 }, {
     "pattern": "badge\\.facebook\\.com",
     "name": "Facebook Social Plugins",
     "id": "1006",
     "type":"Widget"
 }, {
     "pattern": "fbcdn\\.net\\/connect\\.php\\/js\\/fb\\.share",
     "name": "Facebook Social Plugins",
     "id": "1030",
     "type":"Widget"
 }, {
     "pattern": "\\.chango\\.(ca|com)",
     "name": "Chango",
     "id": "720"
 }, {
     "pattern": "cdna\\.tremormedia\\.com",
     "name": "Tremor Media",
     "id": "722"
 }, {
     "pattern": "objects\\.tremormedia\\.com\\/embed\\/js",
     "name": "Tremor Media",
     "id": "1090"
 }, {
     "pattern": "admonkey\\.dapper\\.net",
     "name": "Dapper",
     "id": "723"
 }, {
     "pattern": "p-td\\.com",
     "name": "Accuen Media",
     "id": "724"
 }, {
     "pattern": "yieldoptimizer\\.com",
     "name": "Adara Media",
     "id": "726"
 }, {
     "pattern": "displaymarketplace\\.com",
     "name": "Datran",
     "id": "728"
 }, {
     "pattern": "ads\\.addynamix\\.com\\/category",
     "name": "Ybrant Media",
     "id": "732"
 }, {
     "pattern": "ad\\.adserverplus\\.com",
     "name": "Ybrant Media",
     "id": "870"
 }, {
     "pattern": "(dd|ff)\\.connextra\\.com",
     "name": "Connextra",
     "id": "734"
 }, {
     "pattern": "(api|apps)\\.conduit\\.com",
     "name": "Conduit",
     "id": "736"
 }, {
     "pattern": "conduit-banners\\.com",
     "name": "Conduit",
     "id": "985"
 }, {
     "pattern": "udmserve\\.net",
     "name": "Underdog Media",
     "id": "738"
 }, {
     "pattern": "pixel\\.adpredictive\\.com",
     "name": "AdPredictive",
     "id": "740"
 }, {
     "pattern": "px\\.steelhousemedia\\.com",
     "name": "Steel House Media",
     "id": "742"
 }, {
     "pattern": "tracking\\.godatafeed\\.com",
     "name": "GoDataFeed",
     "id": "744"
 }, {
     "pattern": "\\.trumba\\.com\\/scripts\\/spuds\\.js",
     "name": "Trumba",
     "id": "745"
 }, {
     "pattern": "adspaces\\.ero-advertising\\.com",
     "name": "EroAdvertising",
     "id": "746"
 }, {
     "pattern": "ads\\.adxpansion\\.com",
     "name": "AdXpansion",
     "id": "747"
 }, {
     "pattern": "clarity\\.adinsight\\.eu\\/static\\/adinsight",
     "name": "AdInsight Clarity",
     "id": "748"
 }, {
     "pattern": "\\/performable\\/pax",
     "name": "Performable",
     "id": "749"
 }, {
     "pattern": "snapabug\\.appspot\\.com\\/snapabug",
     "name": "SnapEngage",
     "id": "750"
 }, {
     "pattern": "breathe\\.c3metrics\\.com",
     "name": "C3 Metrics",
     "id": "751"
 }, {
     "pattern": "um\\.simpli\\.fi\\/ab_match",
     "name": "Simpli.fi",
     "id": "752"
 }, {
     "pattern": "dt\\.admission\\.net\\/retargeting\\/displaytracker\\.js",
     "name": "Cobalt Group",
     "id": "754"
 }, {
     "pattern": "yumenetworks\\.com\\/dynamic",
     "name": "YuMe, Inc.",
     "id": "755"
 }, {
     "pattern": "trk\\.vindicosuite\\.com\\/Tracking\\/",
     "name": "Vindico Group",
     "id": "758"
 }, {
     "pattern": "creativeby2\\.unicast\\.com\\/(assets|script2)",
     "name": "Unicast",
     "id": "760"
 }, {
     "pattern": "(hs|sw)\\.interpolls\\.com",
     "name": "Interpolls",
     "id": "763"
 }, {
     "pattern": "rs\\.gwallet\\.com\\/r1\\/pixel",
     "name": "RadiumOne",
     "id": "766"
 }, {
     "pattern": "wtp101\\.com\\/",
     "name": "Adnetik",
     "id": "768"
 }, {
     "pattern": "\\.adshuffle\\.com\\/",
     "name": "AdShuffle",
     "id": "769"
 }, {
     "pattern": "(servedby|stat|cdn|a)\\.flashtalking\\.com\\/",
     "name": "Flashtalking",
     "id": "771"
 }, {
     "pattern": "(servedby|ads|event)\\.adxpose\\.com",
     "name": "AdXpose",
     "id": "773"
 }, {
     "pattern": "adcentriconline\\.com",
     "name": "AdCentric",
     "id": "1023"
 }, {
     "pattern": "nspmotion\\.com",
     "name": "Admotion",
     "id": "1154"
 }, {
     "pattern": "segs\\.btrll\\.com\\/v[0-9]\\/tpix\\/",
     "name": "BrightRoll",
     "id": "820"
 }, {
     "pattern": "\\.smartadserver\\.com",
     "name": "SMART AdServer",
     "id": "982"
 }, {
     "pattern": "spotxchange\\.com\\/track",
     "name": "SpotXchange",
     "id": "986"
 }, {
     "pattern": "mi\\.adinterax\\.com\\/(js|customer)",
     "name": "AdInterax",
     "id": "929"
 }, {
     "pattern": "utag\\.loader\\.js",
     "name": "Tealium",
     "id": "812"
 }, {
     "pattern": "(us\\.img|ads)\\.e-planning\\.net",
     "name": "e-planning",
     "id": "814"
 }, {
     "pattern": "choices\\.truste\\.com\\/ca",
     "name": "TRUSTe Notice",
     "id": "816"
 }, {
     "pattern": "choicesj\\.truste\\.com\\/ca",
     "name": "TRUSTe Notice",
     "id": "1001"
 }, {
     "pattern": "btstatic\\.com",
     "name": "BrightTag",
     "id": "817"
 }, {
     "pattern": "s\\.thebrighttag\\.com",
     "name": "BrightTag",
     "id": "959"
 }, {
     "pattern": "tldadserv\\.com\\/impopup\\.php",
     "name": "TLDAdserv",
     "id": "818"
 }, {
     "pattern": "wiredminds\\.de\\/track",
     "name": "WiredMinds",
     "id": "819"
 }, {
     "pattern": "p\\.brilig\\.com\\/contact\\/bct",
     "name": "Brilig",
     "id": "821"
 }, {
     "pattern": "xcdn\\.xgraph\\.net\\/([0-9]|partner\\.js)",
     "name": "XGraph",
     "id": "823"
 }, {
     "pattern": "cdn\\.doubleverify\\.com\\/oba",
     "name": "DoubleVerify Notice",
     "id": "825"
 }, {
     "pattern": "beencounter\\.com\\/b\\.js",
     "name": "Beencounter",
     "id": "828"
 }, {
     "pattern": "traveladvertising\\.com\\/live\\/tan",
     "name": "Travel Ad Network",
     "id": "831"
 }, {
     "pattern": "everestjs\\.net|pixel([0-9]*)?\\.everesttech\\.net",
     "name": "Efficient Frontier",
     "id": "833"
 }, {
     "pattern": "ctasnet\\.com",
     "name": "Crimtan",
     "id": "836"
 }, {
     "pattern": "raasnet\\.com",
     "name": "Red Aril",
     "id": "839"
 }, {
     "pattern": "eyereturn\\.com",
     "name": "eyeReturn Marketing",
     "id": "841"
 }, {
     "pattern": "rainbow\\.mythings\\.com",
     "name": "My Things Media",
     "id": "843"
 }, {
     "pattern": "esm1\\.net",
     "name": "Think Realtime",
     "id": "845"
 }, {
     "pattern": "domdex\\.(net|com)",
     "name": "Magnetic",
     "id": "927"
 }, {
     "pattern": "qjex\\.net",
     "name": "Magnetic",
     "id": "928"
 }, {
     "pattern": "adconnexa\\.com",
     "name": "OxaMedia",
     "id": "848"
 }, {
     "pattern": "\\.spongecell\\.com\\/",
     "name": "Spongecell",
     "id": "850"
 }, {
     "pattern": "\\.tradedoubler\\.com",
     "name": "TradeDoubler",
     "id": "968"
 }, {
     "pattern": "effectivemeasure\\.net",
     "name": "Effective Measure",
     "id": "1011"
 }, {
     "pattern": "ads\\.brand\\.net",
     "name": "Brand.net",
     "id": "890"
 }, {
     "pattern": "surveybuilder\\.buzzlogic\\.com",
     "name": "BuzzLogic",
     "id": "899"
 }, {
     "pattern": "adserver\\.veruta\\.com",
     "name": "Veruta",
     "id": "908"
 }, {
     "pattern": "veruta\\.com\\/scripts\\/trackmerchant\\.js",
     "name": "Veruta",
     "id": "909"
 }, {
     "pattern": "((p(shared|files|thumbnails))|embed)\\.5min\\.com\\/",
     "name": "5min Media",
     "id": "864"
 }, {
     "pattern": "stat\\.yellowtracker\\.com",
     "name": "YellowTracker",
     "id": "866"
 }, {
     "pattern": "\\.backbeatmedia\\.com",
     "name": "Back Beat Media",
     "id": "867"
 }, {
     "pattern": "(amconf|core|adcontent)\\.videoegg\\.com\\/(siteconf|eap|alternates|ads)\\/",
     "name": "Say Media",
     "id": "871"
 }, {
     "pattern": "contaxe\\.com\\/go",
     "name": "Conteaxe",
     "id": "873"
 }, {
     "pattern": "ad\\.zanox\\.com",
     "name": "Zanox",
     "id": "874"
 }, {
     "pattern": "zbox\\.zanox\\.com",
     "name": "Zanox",
     "id": "875"
 }, {
     "pattern": "www\\.zanox-affiliate\\.de\\/ppv\\/",
     "name": "Zanox",
     "id": "876"
 }, {
     "pattern": "rts\\.sparkstudios\\.com\\/",
     "name": "Spark Studios",
     "id": "878"
 }, {
     "pattern": "adserver\\.juicyads\\.com",
     "name": "JuicyAds",
     "id": "879"
 }, {
     "pattern": "ads\\.pheedo\\.com",
     "name": "Pheedo",
     "id": "880"
 }, {
     "pattern": "www\\.cbox\\.ws\\/box",
     "name": "Cbox",
     "id": "881"
 }, {
     "pattern": "ads\\.ad4game\\.com",
     "name": "ad4game",
     "id": "883"
 }, {
     "pattern": "a\\.ucoz\\.net",
     "name": "uCoz",
     "id": "884"
 }, {
     "pattern": "(do\\.am|at\\.ua)\\/stat\\/",
     "name": "uCoz",
     "id": "1066"
 }, {
     "pattern": "ucoz\\.(.*)\\/(stat\\/|main\\/\\?a=ustat)",
     "name": "uCoz",
     "id": "1067"
 }, {
     "pattern": "c\\.bigmir\\.net",
     "name": "bigmir",
     "id": "885"
 }, {
     "pattern": "\\.tradetracker\\.net",
     "name": "TradeTracker",
     "id": "886"
 }, {
     "pattern": "tqlkg\\.com\\/image",
     "name": "Commission Junction",
     "id": "888"
 }, {
     "pattern": "qksz\\.net",
     "name": "Commission Junction",
     "id": "948"
 }, {
     "pattern": "ftjcfx\\.com",
     "name": "Commission Junction",
     "id": "952"
 }, {
     "pattern": "tqlkg\\.com",
     "name": "Commission Junction",
     "id": "953"
 }, {
     "pattern": "yceml\\.net",
     "name": "Commission Junction",
     "id": "954"
 }, {
     "pattern": "js\\.geoads\\.com",
     "name": "GeoAds",
     "id": "891"
 }, {
     "pattern": "certifica\\.js",
     "name": "Certifica Metric",
     "id": "892"
 }, {
     "pattern": "certifica-js14\\.js",
     "name": "Certifica Metric",
     "id": "893"
 }, {
     "pattern": "hits\\.e\\.cl",
     "name": "Certifica Metric",
     "id": "894"
 }, {
     "pattern": "prima\\.certifica\\.com",
     "name": "Certifica Metric",
     "id": "895"
 }, {
     "pattern": "ads\\.traffiq\\.com",
     "name": "Traffiq",
     "id": "896"
 }, {
     "pattern": "livepass\\.conviva\\.com",
     "name": "Conviva",
     "id": "898"
 }, {
     "pattern": "cadreon\\.com\\/tags\\/defaultads",
     "name": "Cadreon",
     "id": "900"
 }, {
     "pattern": "d1qpxk1wfeh8v1\\.cloudfront\\.net",
     "name": "Cadreon",
     "id": "949"
 }, {
     "pattern": "184\\.73\\.199\\.28\\/tracker\\/event",
     "name": "SkyTide Anlaytics",
     "id": "902"
 }, {
     "pattern": "a\\.akncdn\\.com",
     "name": "AdKeeper",
     "id": "903"
 }, {
     "pattern": "c\\.betrad\\.com\\/geo\\/ba\\.js",
     "name": "Evidon Notice",
     "id": "904"
 }, {
     "pattern": "beacon\\.dedicatednetworks\\.com",
     "name": "Dedicated Networks",
     "id": "905"
 }, {
     "pattern": "ads\\.dedicatedmedia\\.com",
     "name": "Dedicated Media",
     "id": "906"
 }, {
     "pattern": "anormal-tracker\\.de\\/tracker\\.js",
     "name": "Anormal Tracker",
     "id": "910"
 }, {
     "pattern": "anormal-tracker\\.de\\/countv2\\.php",
     "name": "Anormal Tracker",
     "id": "911"
 }, {
     "pattern": "roia\\.biz\\/",
     "name": "TrackingSoft",
     "id": "912"
 }, {
     "pattern": "(ads|sync|set)\\.(adaptv|tidaltv)\\.(tv|com)",
     "name": "Adap.tv",
     "id": "913"
 }, {
     "pattern": "specificmedia\\.com\\/otherassets\\/ad_options_icon\\.png",
     "name": "Specific Media Notice",
     "id": "915"
 }, {
     "pattern": "\\.keewurd\\.com\\/",
     "name": "Peerset",
     "id": "916"
 }, {
     "pattern": "rt\\.liftdna\\.com",
     "name": "LiftDNA",
     "id": "917"
 }, {
     "pattern": "paid-to-promote\\.net\\/images\\/ptp\\.gif",
     "name": "Paid-To-Promote",
     "id": "918"
 }, {
     "pattern": "777seo\\.com\\/",
     "name": "Paid-To-Promote",
     "id": "919"
 }, {
     "pattern": "\\.adsrvr\\.org",
     "name": "TradeDesk",
     "id": "923"
 }, {
     "pattern": "hurra\\.com\\/ostracker\\.js",
     "name": "Hurra Tracker",
     "id": "925"
 }, {
     "pattern": "sp1\\.convertro\\.com",
     "name": "Convertro",
     "id": "926"
 }, {
     "pattern": "d1ivexoxmp59q7\\.cloudfront\\.net",
     "name": "Convertro",
     "id": "1117"
 }, {
     "pattern": "ad\\.adperium\\.com",
     "name": "AdPerium",
     "id": "931"
 }, {
     "pattern": "adlily\\.adperium\\.com",
     "name": "AdPerium",
     "id": "932"
 }, {
     "pattern": "\\.adperium\\.com\\/js\\/adframe\\.js",
     "name": "AdPerium",
     "id": "933"
 }, {
     "pattern": "\\.adperium\\.com\\/abd\\.php",
     "name": "AdPerium",
     "id": "934"
 }, {
     "pattern": "tags\\.nabbr\\.com",
     "name": "Nabbr",
     "id": "936"
 }, {
     "pattern": "\\.dmtry\\.com",
     "name": "Adometry",
     "id": "937"
 }, {
     "pattern": "\\/ki\\.js\\/",
     "name": "KissInsights",
     "id": "939"
 }, {
     "pattern": "j\\.kissinsights\\.com",
     "name": "KissInsights",
     "id": "940"
 }, {
     "pattern": "cdn\\.optimizely\\.com\\/js\\/",
     "name": "Optimizely",
     "id": "943"
 }, {
     "pattern": "webgozar\\.ir\\/c\\.aspx",
     "name": "WebGozar",
     "id": "944"
 }, {
     "pattern": "webgozar\\.com\\/counter",
     "name": "WebGozar",
     "id": "945"
 }, {
     "pattern": "r\\.i\\.ua",
     "name": "i.ua",
     "id": "946"
 }, {
     "pattern": "hotlog\\.ru\\/cgi-bin\\/hotlog",
     "name": "HotLog",
     "id": "947"
 }, {
     "pattern": "cn01\\.dwstat\\.cn",
     "name": "dwstat.cn",
     "id": "950"
 }, {
     "pattern": "(gopjn|pjatr|pjtra|pntra|pntrac|pntrs)\\.com\\/",
     "name": "Pepperjam",
     "id": "951"
 }, {
     "pattern": "analytics\\.matchbin\\.com",
     "name": "Matchbin",
     "id": "955",
     "type":"Analytics"
 }, {
     "pattern": "ads\\.matchbin\\.com",
     "name": "Matchbin",
     "id": "956"
 }, {
     "pattern": "shareasale\\.com",
     "name": "ShareASale",
     "id": "957"
 }, {
     "pattern": "pages\\.etology\\.com\\/",
     "name": "Etology",
     "id": "958"
 }, {
     "pattern": "ads2?\\.smowtion\\.com",
     "name": "Smowtion",
     "id": "960"
 }, {
     "pattern": "imgsrv\\.nextag\\.com\\/imagefiles\\/includes\\/roitrack\\.js",
     "name": "Nextag ROI Optimizer",
     "id": "961"
 }, {
     "pattern": "pixel\\.adsafeprotected\\.com",
     "name": "AdSafe",
     "id": "966"
 }, {
     "pattern": "fw\\.adsafeprotected\\.com",
     "name": "AdSafe",
     "id": "967"
 }, {
     "pattern": "\\.streamray\\.com",
     "name": "FriendFinder Network",
     "id": "969",
     "type":"Widget"
 }, {
     "pattern": "\\.pop6\\.com",
     "name": "FriendFinder Network",
     "id": "970",
     "type":"Widget"
 }, {
     "pattern": "\\.cams\\.com",
     "name": "FriendFinder Network",
     "id": "971",
     "type":"Widget"
 }, {
     "pattern": "\\.nostringsattached\\.com",
     "name": "FriendFinder Network",
     "id": "972",
     "type":"Widget"
 }, {
     "pattern": "\\.getiton\\.com",
     "name": "FriendFinder Network",
     "id": "973",
     "type":"Widget"
 }, {
     "pattern": "\\.adultfriendfinder\\.com",
     "name": "FriendFinder Network",
     "id": "974",
     "type":"Widget"
 }, {
     "pattern": "\\.double-check\\.com",
     "name": "FriendFinder Network",
     "id": "975",
     "type":"Widget"
 }, {
     "pattern": "\\.facebookofsex\\.com",
     "name": "FriendFinder Network",
     "id": "976",
     "type":"Widget"
 }, {
     "pattern": "\\.amigos\\.com",
     "name": "FriendFinder Network",
     "id": "1140",
     "type":"Widget"
 }, {
     "pattern": "cdn\\.technoratimedia\\.com",
     "name": "Technorati Media",
     "id": "980"
 }, {
     "pattern": "\\.sponsorads\\.de",
     "name": "SponsorAds.de",
     "id": "983"
 }, {
     "pattern": "adserver\\.advertisespace\\.com",
     "name": "AdvertiseSpace",
     "id": "987"
 }, {
     "pattern": "ads\\.advertisespace\\.com",
     "name": "AdvertiseSpace",
     "id": "988"
 }, {
     "pattern": "dinclinx\\.com",
     "name": "Madison Logic",
     "id": "989"
 }, {
     "pattern": "platform\\.twitter\\.com\\/widgets",
     "name": "Twitter Button",
     "id": "991",
     "type":"Widget"
 }, {
     "pattern": "sitebro\\.net\\/track\\.js",
     "name": "SiteBro",
     "id": "992"
 }, {
     "pattern": "static\\.polldaddy\\.com\\/p",
     "name": "Polldaddy",
     "id": "993"
 }, {
     "pattern": "contextlinks\\.netseer\\.com",
     "name": "NetSeer",
     "id": "994"
 }, {
     "pattern": "\\.adform\\.net",
     "name": "AdForm",
     "id": "995"
 }, {
     "pattern": "ads\\.newtention\\.net",
     "name": "Newtention",
     "id": "997"
 }, {
     "pattern": "trk\\.newtention\\.net",
     "name": "Newtention",
     "id": "998"
 }, {
     "pattern": "eplayer\\.clipsyndicate\\.com\\/",
     "name": "Clip Syndicate",
     "id": "1003"
 }, {
     "pattern": "\\.adition\\.com",
     "name": "Adition",
     "id": "1004"
 }, {
     "pattern": "ad\\.clickotmedia\\.com",
     "name": "Adorika",
     "id": "1005"
 }, {
     "pattern": "d1ros97qkrwjf5\\.cloudfront\\.net",
     "name": "New Relic",
     "id": "1009"
 }, {
     "pattern": "apis\\.google\\.com\\/js\\/plusone\\.js",
     "name": "Google +1",
     "id": "1010",
     "type":"Widget"
 }, {
     "pattern": "srv\\.clickfuse\\.com",
     "name": "ToneFuse",
     "id": "1013"
 }, {
     "pattern": "\\.opentracker\\.net",
     "name": "Opentracker",
     "id": "1016"
 }, {
     "pattern": "(img|script)\\.footprintlive\\.com",
     "name": "Footprint",
     "id": "1017"
 }, {
     "pattern": "adreactor\\.com",
     "name": "AdReactor",
     "id": "1018"
 }, {
     "pattern": "adocean\\.pl",
     "name": "AdOcean",
     "id": "1021"
 }, {
     "pattern": "waterfrontmedia\\.com",
     "name": "Everyday Health",
     "id": "1024"
 }, {
     "pattern": "\\.meteorsolutions\\.com\\/",
     "name": "Meteor Solutions",
     "id": "1068"
 }, {
     "pattern": "freeonlineusers\\.com\\/",
     "name": "Free Online Users",
     "id": "1069"
 }, {
     "pattern": "\\.statistics\\.ro\\/",
     "name": "statistics.ro",
     "id": "1070"
 }, {
     "pattern": "\\.keymetric\\.net\\/",
     "name": "KeyMetric",
     "id": "1071"
 }, {
     "pattern": "\\.advertserve\\.com\\/",
     "name": "AdvertServe",
     "id": "1072"
 }, {
     "pattern": "\\.successfultogether\\.co\\.uk\\/",
     "name": "Affili.net",
     "id": "1073"
 }, {
     "pattern": "d3pkntwtp2ukl5\\.cloudfront\\.net\\/",
     "name": "Unbounce",
     "id": "1074"
 }, {
     "pattern": "t\\.unbounce\\.com\\/",
     "name": "Unbounce",
     "id": "1075"
 }, {
     "pattern": "zopim\\.com\\/",
     "name": "Zopim",
     "id": "1076"
 }, {
     "pattern": "ads\\.brainient\\.com\\/",
     "name": "Brainient",
     "id": "1077"
 }, {
     "pattern": "ad\\.103092804\\.com\\/",
     "name": "Kitara Media",
     "id": "1079"
 }, {
     "pattern": "\\.trafficrevenue\\.net\\/",
     "name": "Traffic Revenue",
     "id": "1080"
 }, {
     "pattern": "\\.adbull\\.com\\/",
     "name": "AdBull",
     "id": "1081"
 }, {
     "pattern": "\\.complexmedianetwork\\.com\\/",
     "name": "Complex Media Network",
     "id": "1082"
 }, {
     "pattern": "\\.complex\\.com\\/",
     "name": "Complex Media Network",
     "id": "1083"
 }, {
     "pattern": "pocketcents\\.com\\/",
     "name": "PocketCents",
     "id": "1084"
 }, {
     "pattern": "\\/hellobar\\.js",
     "name": "Hello Bar",
     "id": "1085"
 }, {
     "pattern": "\\.ppctracking\\.net",
     "name": "Direct Response Group",
     "id": "1086"
 }, {
     "pattern": "expo-max\\.com",
     "name": "expo-MAX",
     "id": "1087"
 }, {
     "pattern": "hitsniffer\\.com\\/",
     "name": "HitSniffer",
     "id": "1088"
 }, {
     "pattern": "\\.impressiondesk\\.com\\/",
     "name": "Infectious Media",
     "id": "1089"
 }, {
     "pattern": "\\.atemda\\.com",
     "name": "AdMeta",
     "id": "1092"
 }, {
     "pattern": "\\/std\\/resource\\/script\\/rwts\\.js",
     "name": "RightWave",
     "id": "1093"
 }, {
     "pattern": "\\.springmetrics\\.com",
     "name": "Spring Metrics",
     "id": "1094"
 }, {
     "pattern": "d3rmnwi2tssrfx\\.cloudfront\\.net",
     "name": "Spring Metrics",
     "id": "1095"
 }, {
     "pattern": "\\.activeconversion\\.com",
     "name": "ActiveConversion",
     "id": "1096"
 }, {
     "pattern": "\\.linkconnector\\.com",
     "name": "LinkConnector",
     "id": "1097"
 }, {
     "pattern": "\\.admedia\\.com",
     "name": "AdMedia",
     "id": "1099"
 }, {
     "pattern": "prosperent\\.com",
     "name": "Prosperent",
     "id": "1102"
 }, {
     "pattern": "\\.exitjunction\\.com",
     "name": "ExitJunction",
     "id": "1103"
 }, {
     "pattern": "\\.dynamicoxygen\\.com",
     "name": "ExitJunction",
     "id": "1104"
 }, {
     "pattern": "wwa\\.wipe\\.de",
     "name": "Wipe Web Anlaytics",
     "id": "1105"
 }, {
     "pattern": "\\.tinystat\\.(ir|com)",
     "name": "Tinystat",
     "id": "1106"
 }, {
     "pattern": "\\.netbina\\.com",
     "name": "NetBina",
     "id": "1107"
 }, {
     "pattern": "radarurl\\.com",
     "name": "RadarURL",
     "id": "1108"
 }, {
     "pattern": "\\.olark\\.com",
     "name": "Olark",
     "id": "1109"
 }, {
     "pattern": "\\.parsely\\.com",
     "name": "Parse.ly",
     "id": "1111"
 }, {
     "pattern": "\\.persianstat\\.com",
     "name": "PersianStat",
     "id": "1112"
 }, {
     "pattern": "\\.lytiks\\.com",
     "name": "Lytiks",
     "id": "1113"
 }, {
     "pattern": "\\.nuffnang\\.com",
     "name": "Nuffnang",
     "id": "1114"
 }, {
     "pattern": "\\.pricegrabber\\.com\\/conversion\\.php",
     "name": "PriceGrabber",
     "id": "1115"
 }, {
     "pattern": "\\.tailsweep\\.com",
     "name": "Tailsweep",
     "id": "1116"
 }, {
     "pattern": "scribol\\.com",
     "name": "Scribol",
     "id": "1118"
 }, {
     "pattern": "\\.indieclick\\.com",
     "name": "IndieClick",
     "id": "1119"
 }, {
     "pattern": "cdn\\.topsy\\.com",
     "name": "Topsy",
     "id": "1120"
 }, {
     "pattern": "\\.investingchannel\\.com",
     "name": "InvestingChannel",
     "id": "1121"
 }, {
     "pattern": "wahoha\\.com",
     "name": "Wahoha",
     "id": "1122"
 }, {
     "pattern": "theblogfrog\\.com",
     "name": "BlogFrog",
     "id": "1123"
 }, {
     "pattern": "pt\\.peerius\\.com",
     "name": "Peerius",
     "id": "1124"
 }, {
     "pattern": "\\.w3roi\\.com",
     "name": "w3roi",
     "id": "1125"
 }, {
     "pattern": "yandex\\.st\\/share\\/",
     "name": "Yandex.API",
     "id": "1127"
 }, {
     "pattern": "2leep\\.com",
     "name": "2leep",
     "id": "1128"
 }, {
     "pattern": "nwidget\\.networkedblogs\\.com",
     "name": "NetworkedBlogs",
     "id": "1129"
 }, {
     "pattern": "ads\\.adonion\\.com",
     "name": "AdOnion",
     "id": "1130"
 }, {
     "pattern": "sa\\.entireweb\\.com\\/sense\\.js",
     "name": "SpeedyAds",
     "id": "1131"
 }, {
     "pattern": "userapi\\.com\\/js\\/api\\/",
     "name": "VKontakte Widgets",
     "id": "1132"
 }, {
     "pattern": "\\.durasite\\.net",
     "name": "DuraSite",
     "id": "1133"
 }, {
     "pattern": "\\.carbonads\\.com",
     "name": "Carbon Ads",
     "id": "1134"
 }, {
     "pattern": "\\.advg\\.jp",
     "name": "AdPlan",
     "id": "1135"
 }, {
     "pattern": "\\.adplan-ds\\.com",
     "name": "AdPlan",
     "id": "1137"
 }, {
     "pattern": "c\\.p-advg\\.com",
     "name": "AdPlan",
     "id": "1138"
 }, {
     "pattern": "\\.adplan\\.ne\\.jp\\/cgi-bin\\/ad\\/se",
     "name": "AdPlan",
     "id": "1139"
 }, {
     "pattern": "\\.unanimis\\.co\\.uk",
     "name": "Unanimis",
     "id": "1141"
 }, {
     "pattern": "\\.adjug\\.com",
     "name": "AdJug",
     "id": "1143"
 }, {
     "pattern": "\\.microad\\.jp\\/",
     "name": "MicroAd",
     "id": "1146"
 }, {
     "pattern": "\\.adlantis\\.jp\\/",
     "name": "AdLantis",
     "id": "1147"
 }, {
     "pattern": "\\.adimg\\.net",
     "name": "AdLantis",
     "id": "1148"
 }, {
     "pattern": "js\\.fout\\.jp\\/",
     "name": "FreakOut",
     "id": "1149"
 }, {
     "pattern": "ad\\.advertise\\.com",
     "name": "Advertise.com",
     "id": "1150"
 }, {
     "pattern": "netscope\\.data\\.marktest\\.pt",
     "name": "Marktest",
     "id": "1151"
 }, {
     "pattern": "avalanchers\\.com\\/(wcode|scripts)\\/",
     "name": "Avalanchers",
     "id": "1152"
 }, {
     "pattern": "\\.visualrevenue\\.com",
     "name": "Visual Revenue",
     "id": "1153"
 }];

/*
 * JavaScript Pretty Date
 * Copyright (c) 2011 John Resig (ejohn.org)
 * Licensed under the MIT and GPL licenses.
 */

// Takes an ISO time and returns a string representing how
// long ago the date represents.
function prettyDate(time){
  var date = time,
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);
      
  if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
    return;
      
  return day_diff == 0 && (
    diff < 60 && "just now" ||
    diff < 120 && "1 minute ago" ||
    diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
    diff < 7200 && "1 hour ago" ||
    diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
}

$jquery(document).ready(function() {
  window.setTimeout(GL.init.call(GL),3000);
});