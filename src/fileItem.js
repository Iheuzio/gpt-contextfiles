class FileItem {
    constructor(uri, selected = false) {
        this.uri = uri;
        this.selected = selected;
    }

    toggleSelected() {
        this.selected = !this.selected;
    }
}

module.exports = FileItem;
