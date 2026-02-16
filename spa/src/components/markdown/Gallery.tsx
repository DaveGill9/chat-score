import styles from './Gallery.module.scss';

interface GalleryProps {
    images: GalleryImage[];
    setLightboxImage?: (image: GalleryImage, collection: GalleryImage[]) => void;
}

export interface GalleryImage {
    document: string;
    pageNumber: number;
    url: string;
    description: string;
}

export default function Gallery({ images, setLightboxImage }: GalleryProps) {
    return (
        <div className={styles.gallery}>                      
            {images?.filter(i => i.url).map((image: GalleryImage) => (
                <div key={image.url} onClick={() => setLightboxImage?.(image, images)}>
                    <div className={styles.image}>
                        <img src={image.url} alt={image.description} />
                    </div>
                    <div className={styles.caption}>
                        <small>{image.document} • Page {image.pageNumber}</small>
                    </div>
                </div>
            ))}
        </div> 
    );
}