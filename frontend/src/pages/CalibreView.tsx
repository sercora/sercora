import {
    useEffect,
    useState
} from "react";

import CalibreCanvas from "../components/calibre/CalibreCanvas";
import CalibreToolbar from "../components/calibre/CalibreToolbar";

import "../styles/calibre.css";


function CalibreView() {

    const [imageUrl, setImageUrl] = useState("");
    const [imageName, setImageName] = useState("");

    useEffect(
        () => () => {
            if (imageUrl)
                URL.revokeObjectURL(imageUrl);
        },
        [
            imageUrl
        ]
    );

    function handleImageSelected(
        file: File
    ) {

        if (imageUrl)
            URL.revokeObjectURL(imageUrl);

        setImageName(file.name);
        setImageUrl(
            URL.createObjectURL(file)
        );

    }

    return (
        <section className="calibre-page">
            <CalibreToolbar
                imageName={imageName}
                onImageSelected={handleImageSelected}
            />
            <CalibreCanvas imageUrl={imageUrl} />
        </section>
    );

}


export default CalibreView;
