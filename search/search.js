// Declare s and a outside the functions
let s, a, searchParam;

console.log(s);

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return results[2].replace(/\+/g, " ");
}


function checkAndLogValues() {
    console.log('Checking and logging values...');
    searchParam = getParameterByName('q');

    // if (/!|@|#|\$|%|\^|&|\*|\(|\)/.test(searchParam)) {
    //     console.log('Special found:', searchParam);
    //     console.log('off to google');
        
       // window.location.href = `https://www.google.com/search?q=${searchParam}`;
    // } else {
        // Use decodeURIComponent to handle URL-encoded characters
        var decodedParam = decodeURIComponent(searchParam);
        console.log('decode:', decodedParam);

        // Split the decodedParam into s and a
        var splitParams = decodedParam.split(' ');
        s = splitParams.shift(); // Take the first element as 's'
        a = splitParams.join(' '); // Join the remaining elements as 'a'

        console.log('a26: ' + a);

        // Log the values of s and a
        console.log('Value of s:', s);
        console.log('Value of a:', a);
    }
// }



function redirectBasedOnParams() {
    // Use s and a directly
    console.log(s);
    console.log(a);
    
    
    
    s = s.toLowerCase() || s || ''; // Make sure s is not null or undefined
    a = a || ''; // Make sure a is not null or undefined
    console.log('a40: ' + a);

    const API_KEY = 'AIzaSyDtBiP0s5TwGX9_G9iMHyke4b1k86JT8i4';
    const spreadsheetId = '1A5oU3WMTWRg8tS2VtJeSmTr7E0tmhfRgUszl9HudCs0';
    const range = 'Sheet1!A:E';
    const sheetLink = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;

    fetch(sheetLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            return response.json();
        })
        .then(data => {
            const redirectionRules = {};

            if (data.values && data.values.length > 0) {
                data.values.forEach(row => {
                    const valueA = row[0] || ''; 
                    const valueD = row[3] || ''; 
                    const value = row[1] || '';
                    const redirectUrl = row[4] || '';

                    if (valueA || valueD) {
                        redirectionRules[valueA] = { value, redirectUrl };
                        redirectionRules[valueD] = { value, redirectUrl };
                    }
                });
            }

            // Check if parameter 'a' is empty or not
            if (!a && /[.,?~!@#$%^&*()]/.test(searchParam) === false) {
                const redirectRow = redirectionRules[s];
                if (redirectRow && redirectRow.redirectUrl && redirectRow.redirectUrl.startsWith('http')) {
                    console.log('Redirecting to:', redirectRow.redirectUrl);
                     window.location.href = redirectRow.redirectUrl;
                } else {
                    
                   //TESTING
                   console.log(s);
                   
                   console.log(a);
                   console.log('off to wyr.es');
                   console.log('searchParam: ' + searchParam);
                   
                    window.location.href = `https://${s}.wyr.es`;
                   
                }
            } else {
                let redirectLink = redirectionRules[s] ? redirectionRules[s].value.replace(/\$/, a) : null;

                if (!redirectLink || !redirectLink.startsWith('http')) {
                    console.error("Invalid or missing site parameter");
                    console.log('searchParam: ' + searchParam);
                    console.log('var a: ' +a);
                    console.log('var s: ' +s);
                    
                   window.location.href = `https://www.google.com/search?q=${searchParam}`;
                    
                } else {
                    console.log('Redirecting to:', redirectLink);
                    //TESTING
                     window.location.href = redirectLink;
                }
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            // window.location.href = '../index.html';
        });
}

window.onload = function () {
    console.log('DOM is fully loaded.');
    checkAndLogValues();

    if (performance.getEntriesByType("navigation")[0].type === "back_forward") {
        // window.location.href = '../index.html';
    } else {
        redirectBasedOnParams();
    }
};
