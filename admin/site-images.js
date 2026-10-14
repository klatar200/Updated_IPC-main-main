// Site Images & Logo — show the picture chosen in "Or pick a picture already
// on the server" before Use This One puts it on the live site.
//
// The list is bare file names ("download.png", "Slide1.png"), so the only way
// to see one used to be to publish it (A12-L9-02-W5-2). The option value is
// the path as stored ("images/site/x.jpg", "uploads/site/x.jpg"), which is
// served from the site root. External file: the admin CSP is script-src 'self'.
(function () {
  function wire() {
    var imgs = document.querySelectorAll('img[data-preview-for]');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        var sel = document.getElementById(img.getAttribute('data-preview-for'));
        if (!sel) return;
        var update = function () {
          var v = sel.value;
          if (!v) { img.hidden = true; img.removeAttribute('src'); img.alt = ''; return; }
          img.src = '/' + v.replace(/^\/+/, '');
          img.alt = 'Preview of ' + v.replace(/^.*\//, '');
          img.hidden = false;
        };
        sel.addEventListener('change', update);
        update();
      })(imgs[i]);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
