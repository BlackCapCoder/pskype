(function() {
	const ipc = require('electron').ipcRenderer;

	// we use this to keep a backup... user can disable notification from settings
	const Notification = window.Notification;

	// use local jquery in this scope
	let $;
	let settings       = ipc.sendSync('settings:get');
	let activityHandle = null;
	let hasActivity    = false;

	if (!settings.EnableNotifications) {
		delete window.Notification;
	}

	ipc.on('opened-main-window', function(event) {
		// Not exactly sure what's happening here, but without setTimeout it unfocuses
		setTimeout(function() {
			document.getElementById('chatInputAreaWithQuotes').focus();
		}, 0);
	});

	ipc.on('status-change', function(event, status) {
		document.querySelector(".PresencePopup-status--" + status).click();
	});

	ipc.on('read-latest-thread', function(event) {
		$('.unseenNotifications:first').closest('.message').get(0).click();
	});

	ipc.on('settings-updated', function(event, Settings) {
		settings = Settings;

		if (settings.EnableNotifications) {
			window.Notification = Notification;
		} else {
			delete window.Notification;
		}

		setActivityHandle(settings.RefreshInterval);
	});

  function processMessage (msg) {
    // console.log(msg);
    if (msg.startsWith('&gt;'))
      msg = "<span class='greentext'>" + msg + "</span>";

    else if (msg.startsWith('[CODE]<br>')) {
      msg = "<code>" + hl.highlightAuto(msg.substr(10).replace(/<br>/g, "\n").replace(/&lt;/g,'<').replace(/&gt;/g,'>')).value + "</code>";
    }

    else if (msg.startsWith('[haskell]')) {
      var code = msg.substr(9).replace(/<br>/g, "\n").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      var id   = Math.floor(Math.random() * 1000);
      
      runhaskell (code, r => {
        var el = document.getElementById(id);
        // el.innerHTML = r;
        // el.removeAttribute('id');
        el.outerHTML = "<code>" + hl.highlight("haskell", "-- Result:\n" + r).value + "</code>";
      });

      msg = "<code>" + hl.highlight("haskell", code).value + "</code>" 
            + "<span class='snippet' id='" + id + "'>Calculating..</span>";
    }
    
    msg = msg.replace(/windows/gi, "<span class='gay'>window$</span>");
    msg = msg.replace(/linux/gi, "<span class='cool'>$&</span>");
    msg = msg.replace(/`(.+?)`/g, "<span class='snippet'>$1</span>");

    return msg;
  }

  function isKeyEscape(event) {
    return event.key == "Escape" || event.key == "Esc" || event.keyCode == 27 || (event.key == "[" && event.ctrlKey);
  }

	function stopIt(event) {
    // console.log(event);

    if (event.srcElement.id == "chatInputAreaWithQuotes") {
      if (isKeyEscape(event)) {
        var hs = document.getElementsByClassName('conversationHistory');

        for (let i = 0; i < hs.length; i++) {
          if (!(hs[i].parentElement.contains(event.srcElement))) continue;
          event.preventDefault();
          return hs[i].querySelector('.conversation').focus();
        }
      }
    } else if (findMode && isKeyEscape(event)) {
      for (let i = 0; i < finds.length; i++)
        finds[i][2].parentElement.removeChild(finds[i][2]);
      findMode = false;
      finds = [];
      event.preventDefault();
      return
    }

    if (event.key == "i" && event.ctrlKey) {
      installAce (event.srcElement);
    }

		if (settings.AltSendKeys && event.keyCode === 13 && event.target.id === "message-box") {
			if (event.ctrlKey) {
				$('.send').click();
			} else {
				// hack to intercept sending message
				var tmp = $('#message-box').val();
				$('#message-box').get(0).value = '';
				$('#message-box').trigger('blur');
				setTimeout(function() {
					$('#message-box').focus();
					$('#message-box').get(0).value = tmp + "\n";
					$('#message-box').trigger('blur');
					$('#message-box').focus();
				}, 0);
			}
		}
	}

  scrollSpeed = 5;
  scrollDecay = 0.95;

  var lastEl;
  var ySpeed = 0;
  function scrollStep () {
    if (Math.abs(ySpeed) < 0.1) return ySpeed = 0;
    // var sc = document.querySelector('.conversationHistory > .conversation');
    var sc = lastEl;

    sc.scrollTop += ySpeed;
    ySpeed *= scrollDecay;
    setTimeout(scrollStep, 20);
  }

  findMode = false;
  var finds    = [];
  var findkeys = "asdfjklrughieqwopzxcvbnm"
  function onKeyPress (e) {
    // console.log(e);
    if (e.srcElement.id == "chatInputAreaWithQuotes" || e.srcElement.classList.contains("ace_text-input")) {
      return;
    }

    if (findMode) {
      var el = undefined;

      for (let i = 0; i < finds.length; i++) {
        if (finds[i][0] == e.key) {
          el = finds[i][1]; break; 
      }}

      if (el != undefined) {
        el.click();
        findElem = el;
        findMode = false;
        for (let i = 0; i < finds.length; i++)
          finds[i][2].parentElement.removeChild(finds[i][2]);

        return;
      }
    }

    // console.log(1);
    if ("jkgGed".indexOf(e.key) != -1) {
      var sc = e.srcElement;
      lastEl = sc;

      if (e.key == 'j') ySpeed += scrollSpeed;
      if (e.key == 'k') ySpeed -= scrollSpeed;
      if (e.key == 'g') sc.scrollTop = 0;
      if (e.key == 'G') sc.scrollTop = sc.scrollHeight;
      if (e.key == 'd') sc.scrollTop += sc.clientHeight * 0.5;
      if (e.key == 'e') sc.scrollTop -= sc.clientHeight * 0.5;

      scrollStep();
    }

    if ("i".indexOf(e.key) != -1) {
      var hs = document.getElementsByClassName('conversationControl');
      var el;

      for (let i = 0; i < hs.length; i++) {
        if (!(hs[i].parentElement.contains(e.srcElement))) continue;
        el = hs[i].querySelector('textarea');
        break;
      }

      // var el = document.getElementById('chatInputAreaWithQuotes');

      if (e.key == 'i') {
        el.focus()
        e.preventDefault();
        return false;
      }
    }

    if (e.key == 'f') {
      var els = document.getElementsByClassName('recent');
      finds = [];

      for (let i = 0; i < els.length; i++) {
        let k = "asdfjklrughieqwopzxcvbnm"[i];
        let e = els[i];
        let f = document.createElement('span');
        let r = e.getBoundingClientRect();

        f.setAttribute('class', 'find-hint');
        f.style.top = r.top + 15 + "px";
        f.style.left = r.left + 4 + "px";
        f.innerText = k;
        document.body.appendChild(f);

        finds.push([k,e,f]);
      }

      findMode = true;
    }
  }

	window.addEventListener('keydown', stopIt, true);
  window.addEventListener('keypress', onKeyPress, true);

function installAce (e) {
  var hs = document.getElementsByClassName('conversationControl');
  var el;

  for (let i = 0; i < hs.length; i++) {
    if (!(hs[i].parentElement.contains(e))) continue;
    el = hs[i].querySelector('.tc');
    break;
  }

  // let el = document.querySelector('.tc');
  let r  = el.getBoundingClientRect;
  let ia = el.querySelector('textarea');

  // if (el == undefined) return;
  // el.classList.remove('tc');

  tb = document.getElementById('message-box');
  if (tb == undefined) {
    tb = document.createElement('div');
    tb.setAttribute('id', 'message-box');
    tb.style.width  = /*r.width */"440" + "px";
    tb.style.height = /*r.height */"96"  + "px";
    tb.style.position = "absolute";
    tb.style.bottom = 0;
    tb.style.right = "5px";
    tb.style.fontSize = "125%";
    tb.style.font = "12px/normal monospace, 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace";
    tb.style.zIndex = "1000";
    tb.style.background = "#220022";
    tb.style.color = "white";
  }

  tb.style.display = "block";
  document.body.appendChild(tb);

  editor = ace.edit('message-box');
  editor.setValue(ia.value);
  editor.setKeyboardHandler("ace/keyboard/vim");
  editor.setAutoScrollEditorIntoView(true);

  setTimeout(_ => {
    var el = document.getElementsByClassName('ace_text-input')[0];
    el.focus ();
  }, 100);
}

	window.addEventListener("DOMContentLoaded", function(event) {

    // Skype is using this excessively, and there is no ill effect of disabling it

    // setTimeout( _ => {
    //   document.querySelector    = undefined;
    //   document.querySelectorAll = undefined;
    // }, 5000);

		$  = require('../assets/jquery-2.2.3.min');
    hl = require("highlight.js");

    try {
      require('../assets/ace-builds/src-min-noconflict/ace.js');
      require('../assets/ace-builds/src-min-noconflict/keybinding-vim.js');
      VimApi = ace.require('ace/keyboard/vim').CodeMirror.Vim;

      VimApi.defineEx("write", "w", function (cm, input) {
        var el = document.getElementById('chatInputAreaWithQuotes')
        el.value=editor.getValue();
        // document.querySelector('.send-button').click()
        setTimeout ( _ => {
          tb.style.display = "none";
          el.focus();
        }, 100);
      });
    } catch (ex) {}

    try {
      runhaskell = require('runhaskell');
    } catch (ex) {}

    // setInterval(installAce, 1000);

    setInterval( _ => {
      var els = document.querySelectorAll(':root .swx .chat .conversation .message .bubble .content > p:not(.PictureSharing):not(.processed)');
      for (let i = 0; i < els.length; i++) {
        var el = els[i]
        el.innerHTML = processMessage(el.innerHTML);
        el.classList.add('processed');
        // el.outerHTML = el.outerHTML.replace("<p ","<message ").replace("</p>", "</message>");

        var observer = new WebKitMutationObserver( (el => _ => {
          if (el.classList.contains('processed')) el.classList.remove('processed');
          el.obs.disconnect();
          console.log('changed');
        }) (el) );
        
        el.obs = observer;

        var config = { childList: true, characterData: true, subtree: true };
        observer.observe(el, config);
      }
    }, 1000);

		// Hacking the skype hack
		document.addEventListener('click', function(event) {
			var $elem = $(event.target).closest('a[rel*="noopener"]');
			if ($elem.length) {
				ipc.sendToHost('open-link', $elem.prop('href'));
			}
		});

		// Every 5 mintues check if user activity
		// If they are not active refresh skype... fixes bug on skype's end
		if (settings.RefreshInterval) {
			setActivityHandle(settings.RefreshInterval);

			$(window).on('mousemove input', function() {
				hasActivity = true;
			});
		}

		// Get an accurate notification count... we can't parse it out of the title
		// because Web Skype has a bug
		let lastCount = 0;
		setInterval(function() {
			// Gets a numeric representation of each thread's unread messages
			let unreadCounters = $('.unseenNotifications').map(function() {
				return Number($(this).find('p').text());
			});

			// Sums them all up
			let count = 0;
			for (let i = 0; i < unreadCounters.length; i++) {
				count += unreadCounters[i];
			}

			// We currently do not have a way to determine who last messaged the user
			// TODO: figure this out by intercepting HTML5 notifications
			if (count > 0 && lastCount !== 0)
				return;

			lastCount = count;
			ipc.sendToHost('notification-count', count);
		}, 500);
	});

	function setActivityHandle(minutes) {
		clearInterval(activityHandle);
		setInterval(checkActivity, minutes * 60000);
	}

	function checkActivity() {
		if (!hasActivity) {
			window.location = window.location;
		}

		hasActivity = false;
	}
}());
