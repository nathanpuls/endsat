window.addEventListener('load', function () {
    // Get the value of the 'name' parameter from the URL
    var urlParams = new URLSearchParams(window.location.search);
    var nameWithDot = urlParams.get('name');

    // Log the full URL and the 'name' parameter to the console
    console.log('Full URL:', window.location.href);
    console.log('Name with Dot:', nameWithDot);

    // Check if the 'name' parameter is present and contains a dot
    if (nameWithDot && nameWithDot.includes('.') && !window.location.href.includes('https://wyr.es/')) {
      // Extract the name after the dot
      var name = nameWithDot.split('.')[0];

      // Log the extracted name to the console
      console.log('Extracted name:', name);

      
      window.location.href = 'https://wyr.es/' + name;
    }
  });