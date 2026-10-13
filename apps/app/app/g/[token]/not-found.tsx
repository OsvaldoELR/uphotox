import { GalleryUnavailable } from "./components/gallery-unavailable";

const GalleryNotFound = () => (
  <GalleryUnavailable
    message="Revisa que el enlace esté completo o pide uno nuevo al estudio."
    title="Este enlace no existe"
  />
);

export default GalleryNotFound;
