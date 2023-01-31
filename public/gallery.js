function gallery() {
    function addPhoto(photo) {
        currentWidth += photo.width + 5;
        row.push(photo);
    }
    const targetHeight = 180;
    const minShrink = 100;
    const maxStretch = 260;
    const photos = document.querySelectorAll('#photos img');
    var currentWidth = 5;
    var diffOmit; //scale
    var diffAdd; //shrink
    var scaleFactor;
    var row = [];
    //alert(window.innerWidth);

    for (var photo of photos) {
        photo._height = targetHeight;
        photo.style.height = photo._height + "px";
        if (currentWidth + photo.width >= window.innerWidth) {
            diffOmit = window.innerWidth - currentWidth;
            diffAdd = currentWidth + photo.width - window.innerWidth;
            if (diffAdd < diffOmit) {
                addPhoto(photo);
            }
            scaleFactor = window.innerWidth / (currentWidth - row.length * 5);
            //alert(scaleFactor * (currentWidth - row.length * 5));
            for (var element of row) {
                element._height *= scaleFactor;
                element._height -= 8;
                element.style.height = element._height + "px";
            }

            currentWidth = 5;
            row = [];
            if (diffOmit <= diffAdd) {
                addPhoto(photo);
            }
        } else {
            addPhoto(photo);
        }
    }
}

gallery();
window.addEventListener("resize", gallery);
window.addEventListener("DOMContentLoaded", gallery);
