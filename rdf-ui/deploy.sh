npm ci
npm run build
pm2 restart rdf-ui-app
pm2 status
pm2 logs rdf-ui --lines 80

pm2 reload rdf-ui-app