npm ci
npm run build
pm2 restart uni-ui-app
pm2 status
pm2 logs uni-ui-app --lines 80

pm2 reload uni-ui-app