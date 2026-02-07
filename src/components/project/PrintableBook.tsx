interface PrintablePage {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
}

interface PrintableBookProps {
  pages: PrintablePage[];
  petName: string;
}

const PrintableBook = ({ pages, petName }: PrintableBookProps) => {
  return (
    <div className="hidden print:block">
      <style>{`
        @media print {
          body > *:not(.printable-book) { display: none !important; }
          .printable-book { display: block !important; }
          .print-page {
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem;
            text-align: center;
          }
          .print-page:last-child { page-break-after: auto; }
          .print-page img {
            max-width: 80%;
            max-height: 50vh;
            object-fit: contain;
            border-radius: 8px;
            margin-bottom: 2rem;
          }
          .print-page p {
            font-size: 18px;
            line-height: 1.8;
            max-width: 500px;
          }
        }
      `}</style>
      <div className="printable-book">
        {pages.map((page) => (
          <div key={page.pageNumber} className="print-page">
            {page.illustrationUrl && (
              <img src={page.illustrationUrl} alt={`Page ${page.pageNumber}`} />
            )}
            <p>{page.textContent}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrintableBook;
