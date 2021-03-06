var cache = {
    commands: [],
    prefs: {
        size: null,
        position: null, 
        theme: null,
        shortcutKey: null,
        searchEngineUrl: null,
        commandEngine: "yubnub",
        quixUrl: "http://quixapp.com/quix.txt",
        scrollingSpeed: null,
        disabledUrls: [],
        espStatus: null,
        scrapers: [],
        espModifiers: [],
        version: null,
		outsideScrollingStatus: null,
		upScrollingKey: null,
		downScrollingKey: null
    }
};

function init() {
    initOptions();
    versionCheck();
    initCommandCache();
}

function versionCheck() {
    if (cache.prefs.version != '1.8')
    {
        cache.prefs.version = '1.8';
        saveOption('version', '1.8');

        // open update.html
        var activeWindow = safari.application.activeBrowserWindow;
        var newTab = activeWindow.openTab();
        newTab.url = "http://thegleebox.com/update.html";
    }
}

function respondToMessage(e) {
    // from content script
    if (e.name == "getOptions") {
        e.target.page.dispatchMessage("updateOptions", cache.prefs);
    }

    // from options page
    else if (e.name == "getOptionsFromOptionsPage")
        e.target.page.dispatchMessage("sendOptionsToOptionsPage", cache.prefs);
        
    else if (e.name == "saveOption")
    {
	    cache.prefs[e.message.name] = e.message.value;
        saveOption(e.message.name, e.message.value);
    }
    
    else if (e.name == "saveOptions")
    {
        cache.prefs = e.message;
        saveOptions();
    }
    
    else if (e.name == "propagateOptions")
    {
        sendRequestToAllTabs({value: "updateOptions", data: cache.prefs});
    }
    
    else if (e.name == "openNewTab")
    {
        var activeWindow = safari.application.activeBrowserWindow;
        var newTab = activeWindow.openTab();
        newTab.url = e.message;
    }
    
    else if (e.name == "openPageIfNotExist")
    {
        var activeWindow = safari.application.activeBrowserWindow;
        var tabs = activeWindow.tabs;
        var len = tabs.length;
        
        for (var i = 0; i < len; i++)
        {
            if (tabs[i].url == e.message)
            {
                tabs[i].activate();
                return;
            }
        }
        // otherwise, open new tab
        var newTab = activeWindow.openTab();
        newTab.url = e.message;
    }

    else if (e.name == "updateOption")
        updateOption(e.message.option, e.message.value);
        
    else if (e.name == "getCommandCache")
        e.target.page.dispatchMessage("receiveCommandCache", cache.commands);
        
    else if (e.name == "updateCommandCache")
    {
        cache.commands = e.message;
        localStorage['gleebox_commands_cache'] = JSON.stringify(cache.commands);
        sendRequestToAllTabs({ value: 'updateCommandCache', data: cache.commands });
    }
    
    else if (e.name == "sendRequest")
    {
        var req = new XMLHttpRequest();
		req.open(e.message.method, e.message.url, true);
		req.onreadystatechange = function(){
			if (req.readyState == 4)
			{
                e.target.page.dispatchMessage("onSendRequestCompletion", req.responseText);
			}
		}
		req.send();
    }
}

function initOptions() {
    for (pref in cache.prefs) {
        if (pref == "espModifiers" || pref == "scrapers" || pref == "disabledUrls") {
            cache.prefs[pref] = JSON.parse(safari.extension.settings.getItem(pref));
        }
        else
            cache.prefs[pref] = safari.extension.settings.getItem(pref);
    }
}

function updateOption(option, value) {
    switch (value)
	{
		case "off"		: value = false; break;
		
		case "on"		: value = true; break;
		case "med"		: value = "medium"; break;
		case "mid"		: value = "middle"; break;
		
		case 'default'	: value = "GleeThemeDefault"; break;
		case 'white'	: value = "GleeThemeWhite"; break;
		case 'console'	: value = "GleeThemeConsole"; break;
		case 'greener'	: value = "GleeThemeGreener"; break;
		case 'ruby'		: value = "GleeThemeRuby"; break;
		case 'glee'		: value = "GleeThemeGlee"; break;
	}
	
	switch (option)
	{
		case "scroll"	: option = "scrollingSpeed";
		                  if(value)
		                    value = 500;
		                  else
		                    value = 0;
		                  break;
		                  
		case "pos"		: 
		case "position" : option = "position";
		                  break;

		case "esp"		: option = "esp_status";
		                  break;
  		                  
		case "vision"	: 
		
		case "visions+"	: var len = cache.prefs.espModifiers.length;
		                  var found = false;
						  for (var i = 0; i < len; i++)
						  {
						    // if an esp vision already exists for url, modify it
							if (cache.prefs.espModifiers[i].url == value.url)
							{
							    cache.prefs.espModifiers[i].selector = value.selector;
							    found = true;
							}
						  }
						  if (!found) {
                              cache.prefs.espModifiers.push(
      						  {
                                    url: value.url,
                                    selector: value.selector
      						  });
						  }
						  saveOption("espModifiers", cache.prefs.espModifiers);
                          sendRequestToAllTabs({value: 'updateOptions', data: cache.prefs});
						  return true;

		case "scrapers+": var len = cache.prefs.scrapers.length;
						  var found = false;
						  
						  for (var i = 0; i < len; i++)
						  {
							if (cache.prefs.scrapers[i].command == value.command)
							{
							    cache.prefs.scrapers[i].selector = value.selector;
                                found = true;
							}
						  }
						  if (!found) {
						      cache.prefs.scrapers.push({
      						      command: value.command,
      							  selector: value.selector,
      							  cssStyle: "GleeReaped",
      							  nullMessage : "Could not find any matching elements on the page."
      						  });
						  }
						  saveOption("scrapers", cache.prefs.scrapers);
                          sendRequestToAllTabs({value: 'updateOptions', data: cache.prefs});
						  return true;
	}
	
	cache.prefs[option] = value;
    saveOption(option, value);
	
	// send request to update options in all tabs
    sendRequestToAllTabs({value: 'updateOptions', data: cache.prefs});
}

function saveOptions() {
    for (pref in cache.prefs)
        saveOption(pref, cache.prefs[pref]);
}

function saveOption(pref, value) {
    if (pref == "scrapers" || pref == "disabledUrls" || pref == "espModifiers") {
        value = JSON.stringify(value);
    }
    safari.extension.settings.setItem(pref, value);
}

function initCommandCache() {
	if (localStorage['gleebox_command_cache'])
    cache.commands = JSON.parse(localStorage['gleebox_commands_cache']);
}

function sendRequestToAllTabs(req) {
    var w_len = safari.application.browserWindows.length;
    for (var i = 0; i < w_len; i++)
    {
        var t_len = safari.application.browserWindows[i].tabs.length;
        for (var j = 0; j < t_len; j++)
            safari.application.browserWindows[i].tabs[j].page.dispatchMessage( req.value,  req.data );
    }
}

safari.application.addEventListener("message", respondToMessage, false);