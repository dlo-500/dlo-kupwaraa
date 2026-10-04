DLO Kupwara — separated website and app files

This package keeps the existing public website homepage and the installed app on separate entry pages:
- index.html is the website homepage, restored from the latest pre-app homepage copy.
- app.html is the app dashboard.
- manifest.json starts the app at app.html while preserving the previous app ID so existing installations can receive the update.
- index.html also forwards older installed-app links (index.html?app=1) to app.html. Normal visits to the website homepage are unchanged.

Upload these package files to the repository root, keeping the same folders:
- index.html (replace the current homepage to restore its website design)
- app.html (new app dashboard entry page)
- manifest.json
- sw.js
- common.js
- config.js
- menu.css
- analytics.html
- search-filter-cases.html
- all files under icons/

Keep the rest of the existing website files, images, data pages, and assets in place. Do not rename app.html to index.html and do not replace index.html with the app dashboard file.

The manifest includes 192px and 512px PNG versions of the supplied icon, plus the original JPEG. The service worker uses a new cache version, activates updates promptly, and requests pages from the network first. Open the installed app once while online after publishing so its browser can fetch the new manifest and service worker. When an app page is open, it refreshes after the new worker takes control if no form draft has changed; if a draft is present, it waits so text is not lost.

Browser behavior: page content updates on the next launch/navigation or service-worker update. Browsers do not push a new page into an offline or already-open app without that app checking for the update. A browser may ask the user to review an app icon/name change separately.

This package is prepared for you to upload; it does not deploy itself to GitHub Pages.
