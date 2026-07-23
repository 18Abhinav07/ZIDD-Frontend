import styles from './LandingAssetGate.module.css';

type ZiddLoaderOverlayProps = {
  label?: string;
};

export function ZiddLoaderOverlay({
  label = 'Loading Zidd',
}: ZiddLoaderOverlayProps) {
  return (
    <div className={styles.gate} aria-label={label} role="status">
      <svg
        className={styles.loader}
        viewBox="-150 -150 2885 1700"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g transform="translate(0,1050) scale(1,-1)">
          <path pathLength="1000" className={styles.reveal0} transform="translate(0,0)" d="M244 140H546V0H50V130L350 562H50V702H546V572Z" />
          <path pathLength="1000" className={styles.reveal1} transform="translate(656,0)" d="M233 702V0H62V702Z" />
          <path pathLength="1000" className={styles.reveal2} transform="translate(1011,0)" d="M693 351Q693 248 647.5 168.0Q602 88 518.5 44.0Q435 0 325 0H62V702H325Q436 702 519.0 658.0Q602 614 647.5 534.5Q693 455 693 351ZM519 351Q519 448 465.0 502.0Q411 556 314 556H233V148H314Q411 148 465.0 201.0Q519 254 519 351Z" />
          <path pathLength="1000" className={styles.reveal3} transform="translate(1798,0)" d="M693 351Q693 248 647.5 168.0Q602 88 518.5 44.0Q435 0 325 0H62V702H325Q436 702 519.0 658.0Q602 614 647.5 534.5Q693 455 693 351ZM519 351Q519 448 465.0 502.0Q411 556 314 556H233V148H314Q411 148 465.0 201.0Q519 254 519 351Z" />
        </g>
      </svg>
    </div>
  );
}
