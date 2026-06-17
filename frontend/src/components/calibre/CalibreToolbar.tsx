type CalibreToolbarProps = {
    imageName: string;
    onImageSelected: (file: File) => void;
};


function CalibreToolbar({
    imageName,
    onImageSelected
}: CalibreToolbarProps) {

    return (
        <header className="calibre-toolbar">
            <div className="calibre-toolbar-title">
                <span>Sercora Calibre</span>
                <strong>Relevé de quantités</strong>
            </div>

            <label className="calibre-upload-button">
                <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={
                        event => {
                            const file = event.target.files?.[0];

                            if (file)
                                onImageSelected(file);

                            event.currentTarget.value = "";
                        }
                    }
                />
                Importer JPG/PNG
            </label>

            <div className="calibre-file-status">
                {imageName || "Aucun plan chargé"}
            </div>
        </header>
    );

}


export default CalibreToolbar;
