import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import usePagedRequest from '../../hooks/usePagedRequest';
import useFetchRequest from '../../hooks/useFetchRequest';
import Feedback from '../../components/feedback/Feedback';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import AnimatedDetailLayout from '../../components/layout/AnimatedDetailLayout';
import IconButton from '../../components/icon/IconButton';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';
import { addSearchParams } from '../../utils';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './TestsPage.module.scss';

type TestSet = {
  _id: string;
  name: string;
  filename: string;
  project?: string | null;
  createdAt: string;
  testCaseCount?: number;
};

type TestCase = {
  _id: string;
  id: string;
  input: string;
  expected: string;
};

type TestSetDetail = TestSet & {
  testCaseCount: number;
  cases: TestCase[];
};

type SortKey = 'createdAt' | 'project' | 'name' | 'testCaseCount';
type SortDirection = 'asc' | 'desc';

export default function TestsPage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [setName, setSetName] = useState('');
  const [project, setProject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const baseUrl = '/tests/sets';
  const [url, setUrl] = useState(baseUrl);
  const { data, setData, loading, reset } = usePagedRequest<TestSet>(url, { limit: 200 });

  const handleSearch = () => {
    if (!keywords.trim()) {
      setUrl(baseUrl);
      return;
    }
    setUrl(addSearchParams(baseUrl, { keywords: keywords.trim() }));
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (setName.trim()) formData.append('name', setName.trim());
    if (project.trim()) formData.append('project', project.trim());

    setUploading(true);
    try {
      const response = await apiClient.post('/tests/upload', formData);
      const created = response.data as {
        testSetId: string;
        name: string;
        filename: string;
        project?: string | null;
        testCaseCount?: number;
      };

      setData((prev) => {
        const next = prev ? [...prev] : [];
        next.unshift({
          _id: created.testSetId,
          name: created.name,
          filename: created.filename,
          project: created.project ?? null,
          createdAt: new Date().toISOString(),
          testCaseCount: created.testCaseCount ?? 0,
        });
        return next;
      });

      setSetName('');
      setProject('');
      toast.success('Test file uploaded');
    } catch (error) {
      toast.error(error);
    } finally {
      setUploading(false);
    }
  };

  const selectFiles = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.multiple = false;
    file.accept = '.csv,.xlsx,.xls';
    file.onchange = (event) => {
      const selected = (event.target as HTMLInputElement).files;
      if (selected && selected.length > 0) {
        void uploadFile(selected[0]);
      }
    };
    file.click();
  };

  const sortedData = useMemo(() => {
    const list = (data ?? []).slice();
    const direction = sortDirection === 'asc' ? 1 : -1;
    const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const compareNumber = (a: number, b: number) => a - b;

    list.sort((a, b) => {
      switch (sortKey) {
        case 'createdAt': {
          const av = new Date(a.createdAt).getTime();
          const bv = new Date(b.createdAt).getTime();
          return direction * compareNumber(av, bv);
        }
        case 'project': {
          const av = (a.project ?? '').trim();
          const bv = (b.project ?? '').trim();
          const base = compareText(av, bv);
          return direction * (base || compareText(a.name, b.name));
        }
        case 'name': {
          const base = compareText(a.name, b.name);
          return direction * (base || compareText(a.filename, b.filename));
        }
        case 'testCaseCount': {
          const av = a.testCaseCount ?? 0;
          const bv = b.testCaseCount ?? 0;
          return direction * (compareNumber(av, bv) || compareText(a.name, b.name));
        }
        default:
          return 0;
      }
    });

    return list;
  }, [data, sortDirection, sortKey]);

  const toggleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'createdAt' ? 'desc' : 'asc');
  };

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null;
    return <span className={styles.sortIndicator}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <Page>
      <Page.Header title="Tests">
        <Input
          type="search"
          placeholder="Find test sets"
          value={keywords}
          onTextChange={setKeywords}
          onEnter={handleSearch}
        />
        <Input
          placeholder="Optional set name"
          value={setName}
          onTextChange={setSetName}
        />
        <Input
          placeholder="Optional project"
          value={project}
          onTextChange={setProject}
        />
        <IconButton icon="upload" onClick={selectFiles} />
        <IconButton icon="cached" onClick={reset} />
      </Page.Header>

      <Page.Content>
        <div className={styles.layout}>
          <div className={styles.list}>
            {uploading && <Feedback type="loading">Uploading test file...</Feedback>}
            {loading && <Feedback type="loading" />}
            {!loading && data?.length === 0 && <Feedback type="empty">No test sets found</Feedback>}

            {!!sortedData.length && (
              <div className={styles.listHeader} role="row">
                <div className={styles.iconCell} aria-hidden />
                <button
                  type="button"
                  className={styles.headerButton}
                  onClick={() => toggleSort('name')}
                  aria-label="Sort by title"
                >
                  Title {sortIndicator('name')}
                </button>
                <button
                  type="button"
                  className={[styles.headerButton, styles.projectCell].join(' ')}
                  onClick={() => toggleSort('project')}
                  aria-label="Sort by project name"
                >
                  Project name {sortIndicator('project')}
                </button>
                <button
                  type="button"
                  className={[styles.headerButton, styles.countCell].join(' ')}
                  onClick={() => toggleSort('testCaseCount')}
                  aria-label="Sort by tests number"
                >
                  Tests number {sortIndicator('testCaseCount')}
                </button>
                <button
                  type="button"
                  className={[styles.headerButton, styles.dateCell].join(' ')}
                  onClick={() => toggleSort('createdAt')}
                  aria-label="Sort by added date"
                >
                  Added {sortIndicator('createdAt')}
                </button>
              </div>
            )}

            {sortedData.map((testSet) => (
              <Button
                type="block"
                key={testSet._id}
                className={[styles.testSet, selectedSetId === testSet._id ? styles.active : ''].join(' ')}
                onClick={() => {
                  setSelectedSetId(testSet._id);
                  setPreviewVisible(true);
                }}
              >
                <div className={styles.iconCell}>
                  <Icon name="description" />
                </div>
                <div className={styles.titleCell}>
                  <strong>{testSet.name}</strong>
                  <span>{testSet.filename}</span>
                </div>
                <div className={styles.projectCell}>{testSet.project || <span className={styles.muted}>—</span>}</div>
                <div className={styles.countCell}>{testSet.testCaseCount ?? 0}</div>
                <div className={styles.dateCell}>{format(new Date(testSet.createdAt), 'h:mma d MMM yyyy')}</div>
              </Button>
            ))}
          </div>

          <AnimatePresence>
            {previewVisible && selectedSetId && (
              <AnimatedDetailLayout
                width={760}
                onClose={() => {
                  setPreviewVisible(false);
                  setSelectedSetId(null);
                }}
              >
                <TestSetPreview
                  testSetId={selectedSetId}
                  onClose={() => {
                    setPreviewVisible(false);
                    setSelectedSetId(null);
                  }}
                  onOpenResults={(testSetId) => navigate(`/results?setId=${testSetId}`)}
                />
              </AnimatedDetailLayout>
            )}
          </AnimatePresence>
        </div>
      </Page.Content>
    </Page>
  );
}

interface TestSetPreviewProps {
  testSetId: string | null;
  onClose: () => void;
  onOpenResults: (testSetId: string) => void;
}

function TestSetPreview({ testSetId, onClose, onOpenResults }: TestSetPreviewProps) {
  const { data, loading } = useFetchRequest<TestSetDetail>(testSetId ? `/tests/sets/${testSetId}` : '');
  const previewCases = data?.cases ?? [];

  return (
    <aside className={styles.preview}>
        <div className={styles.previewHeader}>
          <strong>{data?.filename || ''}</strong>
          <IconButton icon="right_panel_close" onClick={onClose} />
        </div>

        <div className={styles.previewContent}>
          {!testSetId && <Feedback type="empty">Select a test file to preview</Feedback>}
          {loading && testSetId && <Feedback type="loading" />}

          {!loading && data && (
            <>
              {previewCases.length === 0 && <Feedback type="empty">No test rows found</Feedback>}
              {previewCases.map((testCase) => (
                <article className={styles.caseCard} key={testCase._id}>
                  <h3>{testCase.id}</h3>
                  <p>
                    <b>Input:</b> {testCase.input}
                  </p>
                  <p>
                    <b>Expected:</b> {testCase.expected}
                  </p>
                </article>
              ))}

              {testSetId && (
                <Button type="button" className={styles.openResultsButton} onClick={() => onOpenResults(testSetId)}>
                  View Results
                </Button>
              )}
            </>
          )}
        </div>
      </aside>
  );
}
