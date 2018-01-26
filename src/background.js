console.log("background.js injected");
chrome.browserAction.onClicked.addListener(function(tab) {
   chrome.tabs.sendMessage(tab.id, {source:"background", type:"click", message:"to front"}, function(result){});
});

var songs = [];
var working = false;

chrome.extension.onMessage.addListener(function(request, sender, callback){
   if (request.source == "front") {
      console.log("message recevied: " + "type:"+request.type);
      if (request.type == "notice"){
            console.log("message: " + request.message);
      }else if (request.type == "download"){
            if (working) {
                  console.log("Already in download process, skipping command.");
            }else{
                  working = true;            
                  console.log("Download process started.");
            };
            songs = request.message;
            startNextDownload();
      }
   }
});

var currentDownloadIndex = 0;
var DOWNLOAD_CHECK_INTERVAL = 500;

function startNextDownload(){
   if (currentDownloadIndex >= songs.length) {
         working = false;
         return;
   };
   var checker = function(id){
         if (id){
            var wait = function(){
                  chrome.downloads.search({"id":id}, function(foundItems){
                     if (foundItems && foundItems.length > 0){
                           var state = foundItems[0].state;
                           if (state == "in_progress"){
                                 setTimeout(wait, DOWNLOAD_CHECK_INTERVAL)
                           }else if (state == "interrupted"){
                                 startNextDownload(); 
                           }else{
                                 currentDownloadIndex++;                           
                                 startNextDownload(); 
                           };
                     }else{
                           startNextDownload();
                     };
                  });                  

            };
            wait();
         }else{
            currentDownloadIndex++;                           ~
            startNextDownload();
         };
   };
   startDownload(currentDownloadIndex, checker);
}

function startDownload(id, callBack){
   var url = songs[currentDownloadIndex].url;
   var filename = replaceForbidden(decodeHtml(    songs[currentDownloadIndex].name.trim() + " - " + songs[currentDownloadIndex].title.trim() + ".mp3"    ));
   console.log("Downloading " + filename + " from url " + url);
//   var output = "";   
//   for (var i = 0; i < filename.length; i++){
//
//       output = output + " " + filename.charCodeAt(i);
//   }
//   console.log(output);
   chrome.downloads.download({url:      url,
	                      filename: filename,
	                      conflictAction: "overwrite"}, function(id){
	                                                       callBack(id);
	                                                    });

};

function normalizeString(str) {
   return str.replace(/&#([0-9]{1,4});/gi, function(match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
   });
}

function decodeHtml(html) {
   var txt = document.createElement("textarea");
   txt.innerHTML = html;
   return txt.value;
}

function replaceForbidden(str){
   return str.replace(/[\\/:"*?<>|]/g, " ").replace(/\0/g, "").replace(String.fromCharCode(0xFEFF), "");
}

