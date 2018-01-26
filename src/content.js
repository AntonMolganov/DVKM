console.log("content.js injected");



var audios_url = document.getElementById("l_aud").children[0].href;
var user_id = audios_url.substring(audios_url.indexOf("/audios") + 7);
var working = false;
var requested_parts = [];
var DELAY_INTERVAL  = 0;
var DELAY_ERROR_INTERVAL  = 500;
var last_job_start_time = 0;

chrome.runtime.onMessage.addListener(function(request, sender, callback) {
      if (request.source == "background") {
            console.log("message recevied: " + "type:"+request.type);
            if (request.type == "click"){
                  if (working) {
                        chrome.extension.sendMessage({source:"front", type:"notice", message:"job already running"});
                        console.log("job already running");
                        return;
                  };
                  chrome.extension.sendMessage({source:"front", type:"notice", message:"job started"});
                  console.log("job started");
                  working = true;
                  var songs = [];
                  var processIdsCallback = function(result){
                        if (result){
                              var current_part_number = 0;
                              var items_to_request =  [];
                              for (var i = 0; i < result.length; i++){
                                    items_to_request.push(result[i]);
                                    if (items_to_request.length > 9 || i == result.length-1){
                                          requested_parts.push(current_part_number);
                                          var delayedRun = function(items, part_number, delay){
                                                setTimeout(function(){
                                                   var processSongsCallback = function(songs_request_list, part_number, result2){
                                                         if (result2){                          
                                                         
                                                               //debug info                                     
                                                               var oldNum = songs.length;
                                                               if (result2) {
                                                                  if (result2.length > 0) songs = songs.concat(result2);
                                                               };
                                                               var newNum = songs.length;
                                                               console.log(oldNum + " " + newNum);
                                                               //end of debug info
                                                               
                                                               removeFromArray(requested_parts, part_number);
                                                               if (requested_parts.length == 0){
                                                                     chrome.extension.sendMessage({source:"front", type:"download", message:songs});
                                                                     working = false;
                                                                     chrome.extension.sendMessage({source:"front", type:"notice", message:"job done"});
                                                                     console.log("job done");
                                                               }
                                                         }else{
                                                               var current_time = new Date().getTime();
                                                               if (last_job_start_time == 0) {
                                                                     delay = 0;
                                                               }else{
                                                                     delay = last_job_start_time + DELAY_ERROR_INTERVAL - current_time;
                                                                     if (delay < 0) delay = 0;
                                                               } 
                                                               last_job_start_time = current_time + delay;
                                                               console.log("errordelay:"+delay);
                                                               delayedRun(songs_request_list, part_number, delay);
                                                         };
                                                      };
                                                   getEncryptedUrls(items, part_number, processSongsCallback);                                             
                                                }, delay);
                                          };                                          
                                          var current_time = new Date().getTime();
                                          if (last_job_start_time == 0) {
                                                delay = 0;
                                          }else{
                                                delay = last_job_start_time + DELAY_INTERVAL - current_time;
                                                if (delay < 0) delay = 0;
                                          } 
                                          last_job_start_time = current_time + delay;
                                          console.log("delay:"+delay);
                                          delayedRun(items_to_request, current_part_number, delay);
                                          items_to_request = [];
                                          current_part_number++;
                                    };
                              };
                        }else{
                              working = false;
                              chrome.extension.sendMessage({source:"front", type:"notice", message:"job failed"});
                              console.log("job failed");
                        };
                  };          
                  getIds(user_id, processIdsCallback);
            };
      };
});

function getIds(user_id, callback){
      var http = new XMLHttpRequest();
      var url = "al_audio.php";
      var params = "access_hash=&act=load_section&al=1&claim=0&offset=30&owner_id=" + user_id + "&playlist_id=-1&type=playlist";
      http.open("POST", url, true);
      http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      http.onreadystatechange = function() {
               if (http.readyState == 4){
                     if (http.status == 200) {
                           var song_data = [];
                           var result = false;
                           try{
                                 var json_part = http.responseText.split('<!>')[5].substring(7);
                                 var json_data = JSON.parse(json_part);
                                 var json_song_list = json_data.list;
                                 for (var i = 0; i < json_song_list.length; i++){
                                       song_data.push({"id0":json_song_list[i][0],
                                          "id1":json_song_list[i][1],
                                          "name":json_song_list[i][3],
                                          "title":json_song_list[i][4],
                                          "url":json_song_list[i][13]});
                                 }
                                 result = true;
                           }catch (err){
                                 console.log(err);   
                                 result = false;
                           }
                           if (result) {
                                 callback(song_data)
                           }else{
                                 callback(false);
                           };
                     }else{
                           callback(false);
                     };
               };
         };
      http.send(params);
};

function getEncryptedUrls(songs_request_list, part_number, callback){
      var params = "act=reload_audio&al=1&ids=";
      var add_comma = false;
      var id_params = "";
      for (var i = 0; i < songs_request_list.length; i++){
            var id0 = songs_request_list[i].id0 + "";
            var id1 = songs_request_list[i].id1 + "";
            if (id0 && id0.length > 0 && id1 && id1.length > 0){
                  if (add_comma) id_params = id_params + ",";
                  id_params = id_params + id1 + "_" + id0;
                  add_comma = true;
            }
      }
      params = params + encodeURIComponent(id_params);
      var http = new XMLHttpRequest();
      var url = "al_audio.php";
      http.open("POST", url, true);
      http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      http.onreadystatechange = function() {
               if (http.readyState == 4) {
                     if (http.status == 200) {
                           var result = false;
                           try{
                                 var json_part = http.responseText.split('<!>')[5].substring(7);
                                 var json_song_list = JSON.parse(json_part);
                                 var songs_reply_list = [];
                                 for (var i = 0; i < json_song_list.length; i++){
                                       songs_reply_list.push({"name":json_song_list[i][4],
                                          "title":json_song_list[i][3],
                                          "url":decryptUrl(json_song_list[i][2])});
                                 }
                                 result = true;
                           }catch (err){
                                 console.log(err);   
                                 result = false;
                           }
                           if (result) {
                                 callback(songs_request_list, part_number, songs_reply_list);
                           }else{
                                 callback(songs_request_list, part_number, false);
                           };
                     }else{
                           callback(songs_request_list, part_number, false);
                     };
               };
         };
      http.send(params);
}


function removeFromArray(array, value_to_remove){
      if (!array || array.length == 0) return false;
      var index = 0;
      while (index < array.length){
            if (array[index] == value_to_remove){
                  array.splice(index,1);
            }else{
               index++;
            };
      };
      return array;
}


function decryptUrl(t) {
  if ( ~t.indexOf("audio_api_unavailable")) {
    var e = t.split("?extra=")[1].split("#"),
      o = "" === e[1] ? "" : a(e[1]);
    if (e = a(e[0]),
      "string" != typeof o || !e)
      return t;
    o = o ? o.split(String.fromCharCode(9)) : [];
    for (var s, r, n = o.length; n--;) {
      if (r = o[n].split(String.fromCharCode(11)),
        s = r.splice(0, 1, e)[0], !l[s])
        return t;
      e = l[s].apply(null, r)
    }
    if (e && "http" === e.substr(0, 4))
      return e
  }
  return t
}

function a(t) {
  if (!t || t.length % 4 == 1)
    return !1;
  for (var e, i, o = 0, a = 0, s = ""; i = t.charAt(a++);)
    i = r.indexOf(i), ~i && (e = o % 4 ? 64 * e + i : i,
      o++ % 4) && (s += String.fromCharCode(255 & e >> (-2 * o & 6)));
  return s
}

function s(t, e) {
  var i = t.length,
    o = [];
  if (i) {
    var a = i;
    for (e = Math.abs(e); a--;)
      e = (i * (a + 1) ^ e + a) % i,
      o[a] = e
  }
  return o
}

var r = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN0PQRSTUVWXYZO123456789+/=",
  l = {
    v: function(t) {
      return t.split("").reverse().join("")
    },
    r: function(t, e) {
      t = t.split("");
      for (var i, o = r + r, a = t.length; a--;)
        i = o.indexOf(t[a]), ~i && (t[a] = o.substr(i - e, 1));
      return t.join("")
    },
    s: function(t, e) {
      var i = t.length;
      if (i) {
        var o = s(t, e),
          a = 0;
        for (t = t.split(""); ++a < i;)
          t[a] = t.splice(o[i - 1 - a], 1, t[a])[0];
        t = t.join("")
      }
      return t
    },
    i: function(t, e) {
      return l.s(t, e ^ user_id)
    },
    x: function(t, e) {
      var i = [];
      return e = e.charCodeAt(0),
        each(t.split(""), function(t, o) {
          i.push(String.fromCharCode(o.charCodeAt(0) ^ e))
        }),
        i.join("")
    }
  }


