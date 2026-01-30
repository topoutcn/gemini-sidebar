// MAIN world 脚本，运行在 YouTube 页面上下文中
// 可以访问 YouTube 播放器内部 API

window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'GEMINI_GET_CAPTIONS') {
    var tracks = [];
    try {
      var player = document.getElementById('movie_player');
      if (player && player.getOption) {
        try {
          var tracklist = player.getOption('captions', 'tracklist');
          if (tracklist && tracklist.length > 0) {
            tracks = tracklist;
          }
        } catch(e) {}
      }
      if (tracks.length === 0 && player && player.getPlayerResponse) {
        try {
          var resp = player.getPlayerResponse();
          if (resp && resp.captions && resp.captions.playerCaptionsTracklistRenderer) {
            tracks = resp.captions.playerCaptionsTracklistRenderer.captionTracks || [];
          }
        } catch(e) {}
      }
      if (tracks.length === 0 && window.ytInitialPlayerResponse) {
        var r = window.ytInitialPlayerResponse;
        if (r.captions && r.captions.playerCaptionsTracklistRenderer) {
          tracks = r.captions.playerCaptionsTracklistRenderer.captionTracks || [];
        }
      }
    } catch(e) {
      console.log('[Gemini Sidebar PAGE] Error:', e);
    }

    window.postMessage({
      type: 'GEMINI_CAPTIONS_RESULT',
      tracks: tracks.map(function(t) {
        return {
          baseUrl: t.baseUrl || '',
          languageCode: t.languageCode || '',
          name: t.name ? (t.name.simpleText || t.name) : ''
        };
      })
    }, '*');
  }
});
