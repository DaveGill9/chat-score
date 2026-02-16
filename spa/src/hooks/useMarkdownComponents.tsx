import { type Components } from 'react-markdown'
import { IncompleteJsonParser } from 'incomplete-json-parser';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Citation, { type CitationReference } from '../components/markdown/Citation';
import Table from '../components/markdown/Table';
import Error from '../components/markdown/Error';
import DocumentList, { type Document } from '../components/markdown/DocumentList';
import Gallery, { type GalleryImage } from '../components/markdown/Gallery';
import Mermaid from '../components/markdown/Mermaid';
import Image from '../components/markdown/Image';
import PythonCode from '../components/markdown/PythonCode';

const parser = new IncompleteJsonParser();

function parseJson<T>(text: string): T | null {
    try {
        // Try JSON parsing
        return JSON.parse(text) as T;
    }
    catch { 
        // JSON parsing failed
    }
    try {
        // Try incremental parser
        parser.reset();
        parser.write(text);
        return parser.getObjects() as T;
    }
    catch {
        // Both parsing methods failed, return empty
        return null;
    }
}

const customLanguages = [
    'language-gallery',
    'language-document_list',
    'language-error',
    'language-mermaid',
    'language-python',
];

type ShowCitation = (citation: CitationReference) => void;
type ShowLightbox = (image: GalleryImage, collection: GalleryImage[]) => void;

export function useMarkdownComponents(showCitation: ShowCitation, showLightbox: ShowLightbox) {

    const navigate = useNavigate();

    const customComponents: Components = useMemo(() => ({
        pre: (props) => {
            const { node: _node, children, ...rest } = props;
            const innerClassName = (children as React.ReactElement<{ className?: string }>)?.props?.className ?? '';
            if (customLanguages.includes(innerClassName)) {
                return children;
            }
            return <pre {...rest}>{children}</pre>;
        },
        code: (props) => {
            const { node, children, ...rest } = props;
            const innerText = children?.toString() ?? '';
            const className = (node?.properties?.className as string[])?.join(' ') ?? '';
    
            if (!innerText) {
                return '';
            }
    
            // error
            if (className === 'language-error') {
                return <Error message={innerText} />;
            }

            // python code
            if (className === 'language-python') {
                return <PythonCode code={innerText} />;
            }

            // document list
            if (className === 'language-document_list') {
                const documents = parseJson<Document[]>(innerText);
                if (documents) {
                    return <DocumentList documents={documents} />;
                }
            }

            // gallery
            if (className === 'language-gallery') {
                const images = parseJson<GalleryImage[]>(innerText);
                if (images) {
                    return <Gallery images={images} setLightboxImage={showLightbox} />;
                }
            }

            // mermaid
            if (className === 'language-mermaid') {
                return <Mermaid chart={innerText} />;
            }

            // citation
            if (innerText.match(/^citation:/gi)) {
                const json = innerText.replace(/^citation:/gi, '');
                const reference = parseJson<CitationReference>(json);
                if (reference) {
                    return <Citation reference={reference} onClick={() => showCitation(reference)} />;
                }
            }

            // default
            return <code {...rest}>{children}</code>;
        },

        // image
        img: (props) => {
            const { node: _node, src, alt, ...rest } = props;
            return <Image src={src} alt={alt} {...rest} />;
        },

        // table
        table: (props) => {
            const { node: _node, children, ...rest } = props;
            return <Table {...rest}>{children}</Table>;
        },

        // document links
        a: (props) => {
            const { node: _node, href, ...rest } = props;
            if (href?.match(/^\/document\//gi)) {
                const url = href.replace(/^\//gi, '');
                return <a {...props} onClick={() => navigate(url)} style={{ cursor: 'pointer' }} />;
            }
            return <a {...rest} href={href} />;
        }

    }), [showCitation, showLightbox, navigate]);

    return customComponents;
}

