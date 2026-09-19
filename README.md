# Market Lens

A static, client-side NSE stock screener for GitHub Pages. It uses the [Indian Stock Exchange API](https://indianapi.in/documentation/indian-stock-market) to identify symbols below their 200-day moving average and close to their 52-week high or low.

## Run locally

Open `index.html` in a browser, or serve this folder with any static web server. No build step or backend is required.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, select the default branch and the repository root.
3. Open the generated Pages URL.

The application stores the API key and imported symbol list in browser local storage. Add the key under **API settings** after deployment. GitHub Pages is public, so use a restricted API key and never commit it.

## Lists and imports

Open `lists.html` to switch between the local **NSE 200** list and **My portfolio**. The NSE list is read from the bundled `Nifty200.csv` file, so no API call is used to discover the universe.

The portfolio list is read from the bundled `Holdings.csv` file. List uploads have intentionally been removed. Screening combines both files, deduplicates symbols, and makes one `/historical_data?period=1yr&filter=price` request per unique symbol. That response contains the 200 DMA and daily prices, so 52-week high/low are calculated locally; there is no separate 52-week API request. Successful results are cached in browser storage for one day.

Open `reports.html` for the two focused reports: holdings below 200 DMA, and NSE 200 scrips within 5% of their 52-week high while above 200 DMA. Reports use the cached screening results and do not make additional API calls.

If GitHub Pages shows an empty report, open **Reports → Refresh data**, confirm the dialog, and check the status line below the header. If the status says the CSV files cannot be loaded, verify that `Nifty200.csv` and `Holdings.csv` are committed in the same repository root as `reports.html`. GitHub Pages serves committed files only; local browser storage and API results are not deployed with the repository. If a new deployment is not visible, use a hard refresh (`Ctrl+F5`) and check **Actions → Pages build and deployment** for a successful deployment.

The screening limit defaults to 20 symbols to avoid API rate limits. Increase it in API settings when required.
