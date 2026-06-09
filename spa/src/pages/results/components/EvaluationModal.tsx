import Modal from '../../../components/popover/Modal';
import type { Evaluation } from '../types';
import styles from '../ResultDetailPage.module.scss';

interface EvaluationModalProps {
  visible: boolean;
  onClose: () => void;
  evaluation: Evaluation | null;
  loading: boolean;
}

export default function EvaluationModal({ visible, onClose, evaluation, loading }: EvaluationModalProps) {
  return (
    <Modal visible={visible} onClose={onClose}>
      <div className={styles.evalDialog}>
        {(loading || !evaluation) && (
          <div className={styles.evalSkeleton} aria-busy="true" aria-label="Loading evaluation">
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonLine} style={{ width: '95%' }} />
            <div className={styles.skeletonLine} style={{ width: '88%' }} />
            <div className={styles.skeletonLine} style={{ width: '70%' }} />
            <div className={styles.skeletonSection} />
            <div className={styles.skeletonLine} style={{ width: '90%' }} />
            <div className={styles.skeletonLine} style={{ width: '75%' }} />
            <div className={styles.skeletonSection} />
            <div className={styles.skeletonLine} style={{ width: '85%' }} />
            <div className={styles.skeletonLine} style={{ width: '60%' }} />
          </div>
        )}
        {!loading && evaluation && (
          <div className={styles.evalContent}>
            {evaluation.summary && (
              <section className={styles.evalSection}>
                <h3>Summary</h3>
                <p>{evaluation.summary}</p>
              </section>
            )}
            {evaluation.whatWentWell && evaluation.whatWentWell.length > 0 && (
              <section className={styles.evalSection}>
                <h3>What went well</h3>
                <ul>
                  {evaluation.whatWentWell.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {evaluation.whatWentWrong && evaluation.whatWentWrong.length > 0 && (
              <section className={styles.evalSection}>
                <h3>What went wrong</h3>
                <ul>
                  {evaluation.whatWentWrong.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {evaluation.patterns && evaluation.patterns.length > 0 && (
              <section className={styles.evalSection}>
                <h3>Consistent patterns</h3>
                <ul>
                  {evaluation.patterns.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {evaluation.promptChanges && evaluation.promptChanges.length > 0 && (
              <section className={styles.evalSection}>
                <h3>Suggested prompt changes</h3>
                <ul>
                  {evaluation.promptChanges.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {evaluation.suggestions && evaluation.suggestions.length > 0 && (
              <section className={styles.evalSection}>
                <h3>Suggestions</h3>
                <ul>
                  {evaluation.suggestions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
