function displayContacts() {
  const filterInput = document.getElementById("filterInput");
  const resetButton = document.getElementById("resetButton");
  const contactsDiv = document.getElementById("contacts");

  // Event listener for input changes
  filterInput.addEventListener("input", function () {
    const filterValue = filterInput.value.toLowerCase();
    const filteredContacts = Object.entries(contacts).filter(
      ([name, phone]) =>
        name.toLowerCase().includes(filterValue) || phone.includes(filterValue)
    );

    // Display filtered contacts
    contactsDiv.innerHTML = "";
    filteredContacts.forEach(([name, phone]) => {
      const contactItem = document.createElement("div");
      contactItem.className = "contactItem";
      contactItem.textContent = `${name}: ${phone}`;
      contactsDiv.appendChild(contactItem);
    });
  });

  // Event listener for reset button
  resetButton.addEventListener("click", function () {
    // Clear the input field
    filterInput.value = "";

    // Refilter the contacts
    const allContacts = Object.entries(contacts);
    contactsDiv.innerHTML = "";
    allContacts.forEach(([name, phone]) => {
      const contactItem = document.createElement("div");
      contactItem.className = "contactItem";
      contactItem.textContent = `${name}: ${phone}`;
      contactsDiv.appendChild(contactItem);
    });

    // Set focus on the filter input field
    filterInput.focus();
  });

  // Set focus on the filter input field
  filterInput.focus();
}

// Initial display on page load
displayContacts();
