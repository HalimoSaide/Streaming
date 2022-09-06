let lobbyForm = document.getElementById('lobby_form');
lobbyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sessionStorage.setItem('display_name', e.target.name.value);
    window.location = `room.html?room=${e.target.room.value}`;

});
lobbyForm.room.addEventListener('keyup', (e) => {
    let cleaned_value = e.target.value.replace('', '');
    e.target.value = cleaned_value.toUpperCase();
});