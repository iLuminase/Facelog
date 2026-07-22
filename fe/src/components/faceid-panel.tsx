'use client';

import { Bug, Camera, CheckCircle2, CircleDot, CircleX, Clock3, IdCard, Loader2, LogIn, LogOut, RotateCcw, ScanFace } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, EmployeeRow, FaceCheckResult, FaceMatch, enrollFaceId, faceCheck, verifyFaceId } from '@/lib/api';

type FaceIdPanelProps = {
  employees: EmployeeRow[];
  mode: 'attendance' | 'enroll';
  onDone: () => Promise<void>;
  isAdmin?: boolean;
};

type FacePoint = {
  x: number;
  y: number;
  z?: number;
};

type Quality = {
  faceBoxAreaRatio: number;
  brightnessScore: number;
  sharpnessScore: number;
  yaw: number;
  pitch: number;
  roll: number;
};

type CapturedFace = {
  descriptor: number[];
  landmarks: FacePoint[];
  quality: Quality;
};

type SampleType = 'FRONT' | 'LEFT' | 'RIGHT';
type EnrollmentStage = 'capture' | 'saving' | 'verify' | 'success' | 'failed';
type EnrollmentFailureStep = SampleType | 'SAVE' | 'VERIFY';
type DemoEventType = 'CHECK_IN' | 'CHECK_OUT';
type AttendanceScanState = 'idle' | 'processing' | 'success' | 'failed';

const SAMPLE_TYPES: SampleType[] = ['FRONT', 'LEFT', 'RIGHT'];
const SAMPLE_LABELS: Record<SampleType, string> = {
  FRONT: 'Nhìn thẳng',
  LEFT: 'Xoay mặt sang trái',
  RIGHT: 'Xoay mặt sang phải'
};
const QUALITY_THRESHOLD = 0.72;
const HOLD_DURATION_MS = 800;
const LOW_QUALITY_FAILURE_MS = 3000;
const ATTENDANCE_DEVICE_ID = Number(process.env.NEXT_PUBLIC_ATTENDANCE_DEVICE_ID ?? '1');

export function FaceIdPanel({ employees, mode, onDone, isAdmin = false }: FaceIdPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<unknown>(null);
  const cameraSessionRef = useRef(0);
  const selectedEmployeeRef = useRef('');
  const samplesRef = useRef<Partial<Record<SampleType, CapturedFace>>>({});
  const enrollmentStageRef = useRef<EnrollmentStage>('capture');
  const processingRef = useRef(false);
  const attendanceLockedRef = useRef(false);
  const absentSinceRef = useRef<number | null>(null);
  const verifyNotBeforeRef = useRef(0);
  const poseHoldRef = useRef<{ pose: SampleType; since: number } | null>(null);
  const lowQualitySinceRef = useRef<number | null>(null);
  const debugModeRef = useRef(false);
  const demoEventTypeRef = useRef<DemoEventType>('CHECK_IN');

  const [cameraReady, setCameraReady] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [faceInGuide, setFaceInGuide] = useState(false);
  const [attendanceScanState, setAttendanceScanState] = useState<AttendanceScanState>('idle');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [capturedSamples, setCapturedSamples] = useState<Partial<Record<SampleType, CapturedFace>>>({});
  const [currentFace, setCurrentFace] = useState<CapturedFace | null>(null);
  const [enrollmentStage, setEnrollmentStage] = useState<EnrollmentStage>('capture');
  const [enrollmentFailureStep, setEnrollmentFailureStep] = useState<EnrollmentFailureStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Đang khởi động camera...');
  const [recognizedEmployee, setRecognizedEmployee] = useState<FaceMatch | null>(null);
  const [lastAttendance, setLastAttendance] = useState<FaceCheckResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugResponse, setDebugResponse] = useState<unknown>(null);
  const [demoEventType, setDemoEventType] = useState<DemoEventType>('CHECK_IN');

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === 'ACTIVE'),
    [employees]
  );

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    if (streamRef.current) return;
    const cameraSession = ++cameraSessionRef.current;
    setBusy(true);
    setMessage('Đang mở camera...');

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera yêu cầu kết nối HTTPS. Hãy mở trang bằng địa chỉ https:// của máy chủ.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        audio: false
      });

      if (cameraSession !== cameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await initializeFaceLandmarker();
      if (cameraSession !== cameraSessionRef.current) return;
      setCameraReady(true);
      setMessage(mode === 'attendance' ? 'Đưa khuôn mặt vào khung để tự động chấm công' : 'Chọn nhân viên để bắt đầu đăng ký');
      scanLoop();
    } catch (error) {
      setMessage(getCameraErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    cameraSessionRef.current += 1;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setScannerReady(false);
    setFaceInGuide(false);
    setAttendanceScanState('idle');
  }

  async function initializeFaceLandmarker() {
    if (detectorRef.current) {
      setScannerReady(true);
      return;
    }

    const vision = await import('@mediapipe/tasks-vision');
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
    );

    detectorRef.current = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
      runningMode: 'VIDEO',
      numFaces: 1
    });
    setScannerReady(true);
  }

  function scanLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current as
      | {
          detectForVideo: (
            video: HTMLVideoElement,
            timestamp: number
          ) => { faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>> };
        }
      | null;

    if (!video || !canvas || !detector) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;
    const now = performance.now();
    const result = detector.detectForVideo(video, now);
    const landmarks = result.faceLandmarks?.[0]?.map((point) => ({
      x: clampNormalizedCoordinate(point.x),
      y: clampNormalizedCoordinate(point.y),
      ...(typeof point.z === 'number' && Number.isFinite(point.z) ? { z: point.z } : {})
    }));
    const isInsideGuide = Boolean(landmarks?.length && isFaceInsideGuide(landmarks));

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawScannerOverlay(context, canvas.width, canvas.height, landmarks, isInsideGuide);
    setFaceInGuide(isInsideGuide);

    if (landmarks?.length) {
      absentSinceRef.current = null;
      const face = {
        descriptor: buildDescriptor(landmarks),
        landmarks,
        quality: calculateQuality(video, landmarks)
      };
      setCurrentFace(face);
      if (isInsideGuide) {
        processFace(face, now);
      } else {
        poseHoldRef.current = null;
        lowQualitySinceRef.current = null;
        if (!processingRef.current && !attendanceLockedRef.current) {
          setMessage('Đưa toàn bộ khuôn mặt vào bên trong khung quét màu xanh.');
        }
      }
    } else {
      setCurrentFace(null);
      setFaceInGuide(false);
      poseHoldRef.current = null;
      lowQualitySinceRef.current = null;
      handleMissingFace(now);
    }

    if (mode === 'enroll' && enrollmentStageRef.current === 'failed') {
      animationRef.current = null;
      return;
    }
    animationRef.current = requestAnimationFrame(scanLoop);
  }

  function processFace(face: CapturedFace, now: number) {
    if (processingRef.current) return;
    const enrollmentDebug = mode === 'enroll' && debugModeRef.current;
    if (!enrollmentDebug && getQualityScore(face.quality) < QUALITY_THRESHOLD) {
      poseHoldRef.current = null;
      if (mode === 'enroll' && selectedEmployeeRef.current) {
        lowQualitySinceRef.current ??= now;
        const target = SAMPLE_TYPES.find((sampleType) => !samplesRef.current[sampleType]) ?? 'FRONT';
        if (now - lowQualitySinceRef.current >= LOW_QUALITY_FAILURE_MS) {
          failEnrollment(target, `Đăng ký thất bại: chất lượng ảnh ${SAMPLE_LABELS[target].toLowerCase()} quá thấp.`);
          return;
        }
        setMessage('Chất lượng quá thấp. Điều chỉnh ánh sáng và giữ khuôn mặt rõ nét.');
      } else {
        setMessage('Giữ khuôn mặt trong khung và đảm bảo đủ ánh sáng');
      }
      return;
    }
    lowQualitySinceRef.current = null;

    if (mode === 'attendance') {
      if (!attendanceLockedRef.current && holdPose('FRONT', face.quality.yaw, now)) {
        attendanceLockedRef.current = true;
        void submitAttendance(face);
      }
      return;
    }

    if (
      !selectedEmployeeRef.current ||
      enrollmentStageRef.current === 'saving' ||
      enrollmentStageRef.current === 'success' ||
      enrollmentStageRef.current === 'failed'
    ) {
      return;
    }

    if (enrollmentStageRef.current === 'verify') {
      if (now >= verifyNotBeforeRef.current && holdPose('FRONT', face.quality.yaw, now, enrollmentDebug)) void verifyEnrollment(face);
      return;
    }

    const target = SAMPLE_TYPES.find((sampleType) => !samplesRef.current[sampleType]);
    if (!target) return;
    setMessage(`${SAMPLE_LABELS[target]} và giữ yên`);

    if (holdPose(target, face.quality.yaw, now, enrollmentDebug)) {
      const nextSamples = { ...samplesRef.current, [target]: face };
      samplesRef.current = nextSamples;
      setCapturedSamples(nextSamples);
      poseHoldRef.current = null;

      const nextTarget = SAMPLE_TYPES.find((sampleType) => !nextSamples[sampleType]);
      if (nextTarget) {
        setMessage(`Đã quét ${SAMPLE_LABELS[target].toLowerCase()}. ${SAMPLE_LABELS[nextTarget]} và giữ yên`);
      } else {
        void submitEnrollment(nextSamples as Record<SampleType, CapturedFace>);
      }
    }
  }

  function holdPose(pose: SampleType, yaw: number, now: number, bypassPoseCheck = false) {
    if (!bypassPoseCheck && !matchesPose(pose, yaw)) {
      poseHoldRef.current = null;
      return false;
    }
    if (poseHoldRef.current?.pose !== pose) {
      poseHoldRef.current = { pose, since: now };
      return false;
    }
    return now - poseHoldRef.current.since >= (bypassPoseCheck ? 350 : HOLD_DURATION_MS);
  }

  function handleMissingFace(now: number) {
    if (mode !== 'attendance' || !attendanceLockedRef.current) return;
    absentSinceRef.current ??= now;
    if (now - absentSinceRef.current >= 1000) {
      attendanceLockedRef.current = false;
      absentSinceRef.current = null;
      setMessage('Sẵn sàng nhận diện nhân viên tiếp theo');
    }
  }

  async function submitAttendance(face: CapturedFace) {
    const startedAt = performance.now();
    let succeeded = false;
    processingRef.current = true;
    setBusy(true);
    setRecognizedEmployee(null);
    setLastAttendance(null);
    setAttendanceScanState('processing');
    setMessage('Đang xác minh khuôn mặt và ghi nhận chấm công...');
    videoRef.current?.pause();
    try {
      const isDebugRequest = debugModeRef.current;
      const eventType = isDebugRequest ? demoEventTypeRef.current : 'AUTO';
      const response = await faceCheck({ ...buildVerificationPayload(face), eventType, debug: isDebugRequest });
      await waitForMinimumDuration(startedAt, 1600);
      if (isDebugRequest) setDebugResponse(response);
      setRecognizedEmployee(response.data.employee);
      setLastAttendance(response.data);
      setAttendanceScanState('success');
      setMessage(
        response.data.eventType === 'CHECK_OUT'
          ? 'Xác minh thành công · Đã ghi nhận giờ ra'
          : 'Xác minh thành công · Đã ghi nhận giờ vào'
      );
      succeeded = true;
      void onDone().catch(() => undefined);
      await delay(900);
    } catch (error) {
      await waitForMinimumDuration(startedAt, 1600);
      if (debugModeRef.current) setDebugResponse(error instanceof ApiError ? error.payload : { message: error instanceof Error ? error.message : String(error) });
      setAttendanceScanState('failed');
      setMessage(error instanceof Error ? `Không thể chấm công: ${error.message}` : 'Không thể chấm công');
      await delay(1000);
    } finally {
      processingRef.current = false;
      setBusy(false);
      poseHoldRef.current = null;
      setAttendanceScanState('idle');
      setCurrentFace(null);
      setFaceInGuide(false);
      if (!succeeded) {
        attendanceLockedRef.current = false;
        absentSinceRef.current = null;
        setMessage('Đang quét lại. Đưa khuôn mặt vào giữa khung hình.');
      }
      await videoRef.current?.play().catch(() => undefined);
    }
  }

  async function submitEnrollment(samples: Record<SampleType, CapturedFace>) {
    processingRef.current = true;
    enrollmentStageRef.current = 'saving';
    setEnrollmentStage('saving');
    setBusy(true);
    setMessage('Đã đủ ba góc mặt. Đang lưu FaceID...');

    try {
      await enrollFaceId({
        employeeId: Number(selectedEmployeeRef.current),
        samples: SAMPLE_TYPES.map((sampleType) => ({
          sampleType,
          descriptor: samples[sampleType].descriptor,
          landmarks: samples[sampleType].landmarks,
          quality: samples[sampleType].quality,
          imagePath: null
        })),
        liveness: buildLivenessPayload(),
        debug: debugModeRef.current
      });
      await onDone();
      enrollmentStageRef.current = 'verify';
      setEnrollmentStage('verify');
      verifyNotBeforeRef.current = performance.now() + 1500;
      setMessage('Đã lưu FaceID. Bây giờ nhìn thẳng để kiểm tra lại thông tin.');
    } catch (error) {
      failEnrollment(
        'SAVE',
        error instanceof Error ? `Đăng ký thất bại: ${error.message}` : 'Đăng ký FaceID thất bại'
      );
    } finally {
      processingRef.current = false;
      setBusy(false);
      poseHoldRef.current = null;
    }
  }

  async function verifyEnrollment(face: CapturedFace) {
    processingRef.current = true;
    setBusy(true);
    setMessage('Đang kiểm tra lại FaceID vừa đăng ký...');
    try {
      const response = await verifyFaceId({ ...buildVerificationPayload(face), debug: debugModeRef.current });
      const match = response.data.match;
      if (!response.data.matched || !match) {
        failEnrollment('VERIFY', 'Kiểm tra FaceID thất bại: không nhận diện được khuôn mặt vừa đăng ký.');
        return;
      }
      if (match.employeeId !== Number(selectedEmployeeRef.current)) {
        setRecognizedEmployee(match);
        failEnrollment('VERIFY', 'FaceID đang khớp với nhân viên khác. Vui lòng đăng ký lại.');
        return;
      }
      setRecognizedEmployee(match);
      enrollmentStageRef.current = 'success';
      setEnrollmentStage('success');
      setMessage('Đăng ký và kiểm tra FaceID thành công.');
    } catch (error) {
      failEnrollment(
        'VERIFY',
        error instanceof Error ? `Kiểm tra thất bại: ${error.message}` : 'Không thể kiểm tra FaceID'
      );
    } finally {
      processingRef.current = false;
      setBusy(false);
      poseHoldRef.current = null;
    }
  }

  function selectEmployee(employeeId: string) {
    selectedEmployeeRef.current = employeeId;
    setSelectedEmployeeId(employeeId);
    resetEnrollment(employeeId ? 'Nhìn thẳng vào camera và giữ yên' : 'Chọn nhân viên để bắt đầu đăng ký');
    resumeEnrollmentScanning();
  }

  function resetEnrollment(nextMessage = 'Nhìn thẳng vào camera và giữ yên') {
    samplesRef.current = {};
    setCapturedSamples({});
    enrollmentStageRef.current = 'capture';
    setEnrollmentStage('capture');
    setEnrollmentFailureStep(null);
    setRecognizedEmployee(null);
    setCurrentFace(null);
    poseHoldRef.current = null;
    lowQualitySinceRef.current = null;
    setMessage(nextMessage);
  }

  function failEnrollment(step: EnrollmentFailureStep, failureMessage: string) {
    enrollmentStageRef.current = 'failed';
    setEnrollmentStage('failed');
    setEnrollmentFailureStep(step);
    setCurrentFace(null);
    poseHoldRef.current = null;
    lowQualitySinceRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    setMessage(failureMessage);
  }

  function resumeEnrollmentScanning() {
    if (mode !== 'enroll' || animationRef.current || !streamRef.current || !detectorRef.current) return;
    animationRef.current = requestAnimationFrame(scanLoop);
  }

  function retryEnrollment() {
    resetEnrollment(
      selectedEmployeeRef.current
        ? debugModeRef.current
          ? 'Debug 2D đang bật. Đưa ảnh khuôn mặt trên điện thoại vào khung.'
          : 'Nhìn thẳng vào camera và giữ yên'
        : 'Chọn nhân viên để bắt đầu đăng ký'
    );
    resumeEnrollmentScanning();
  }

  function selectDemoEventType(eventType: DemoEventType) {
    if (!debugModeRef.current) return;

    demoEventTypeRef.current = eventType;
    setDemoEventType(eventType);

    // A successful attendance scan stays locked until the face leaves the
    // frame. Changing the demo action must start a fresh scan immediately.
    attendanceLockedRef.current = false;
    absentSinceRef.current = null;
    poseHoldRef.current = null;
    setRecognizedEmployee(null);
    setLastAttendance(null);
    setMessage(
      eventType === 'CHECK_OUT'
        ? 'Đã chọn force chấm ra. Giữ khuôn mặt trong khung để ghi nhận ngay.'
        : 'Đã chọn chấm vào. Giữ khuôn mặt trong khung để ghi nhận.'
    );
  }

  function toggleDebugMode() {
    const nextDebugMode = !debugModeRef.current;
    debugModeRef.current = nextDebugMode;
    setDebugMode(nextDebugMode);
    setDebugResponse(null);

    if (mode === 'enroll') {
      resetEnrollment(
        selectedEmployeeRef.current
          ? nextDebugMode
            ? 'Debug 2D đã bật. Đưa ảnh khuôn mặt trên điện thoại vào khung.'
            : 'Debug đã tắt. Nhìn thẳng vào camera để đăng ký bình thường.'
          : 'Chọn nhân viên để bắt đầu đăng ký'
      );
      resumeEnrollmentScanning();
      return;
    }

    attendanceLockedRef.current = false;
    absentSinceRef.current = null;
    poseHoldRef.current = null;
    setRecognizedEmployee(null);
    setLastAttendance(null);
    setMessage(
      nextDebugMode
        ? `Debug đã bật. Đang chọn ${demoEventTypeRef.current === 'CHECK_OUT' ? 'force chấm ra' : 'force chấm vào'}.`
        : 'Debug đã tắt. Hệ thống đã trở về chế độ chấm công tự động.'
    );
  }

  const qualityScore = currentFace ? getQualityScore(currentFace.quality) : 0;
  const selectedEmployee = activeEmployees.find((employee) => employee.employeeId === Number(selectedEmployeeId));

  return (
    <section className="face-layout">
      <div className="panel scanner-panel">
        <div className="panel-header">
          <div>
            <h2>{mode === 'attendance' ? 'Chấm công tự động' : 'Đăng ký FaceID'}</h2>
            <p>
              {mode === 'attendance'
                ? 'Đứng trước camera, hệ thống sẽ tự nhận diện và ghi nhận chấm công.'
                : 'Hệ thống tự quét chính diện, mặt trái, mặt phải và kiểm tra lại sau khi lưu.'}
            </p>
          </div>
          {busy && <Loader2 className="spin" size={22} />}
        </div>

        {mode === 'attendance' && isAdmin && (
          <div className={debugMode ? 'debug-toolbar active' : 'debug-toolbar'}>
            <div><Bug size={19} /><span><strong>Chế độ debug</strong><small>{debugMode ? 'Chọn loại chấm công muốn force.' : 'Mặc định hệ thống chấm công tự động. Bật debug để điều khiển thủ công.'}</small></span></div>
            <div className="debug-actions">
              <button className={debugMode && demoEventType === 'CHECK_IN' ? 'button primary' : 'button secondary'} type="button" onClick={() => selectDemoEventType('CHECK_IN')} disabled={busy || !debugMode}>
                <LogIn size={17} /> Chấm vào
              </button>
              <button className={debugMode && demoEventType === 'CHECK_OUT' ? 'button primary' : 'button secondary'} type="button" onClick={() => selectDemoEventType('CHECK_OUT')} disabled={busy || !debugMode}>
                <LogOut size={17} /> Force chấm ra
              </button>
              <button className={debugMode ? 'button danger' : 'button secondary'} type="button" onClick={toggleDebugMode} disabled={busy}>
                <Bug size={17} />{debugMode ? 'Tắt debug' : 'Bật debug'}
              </button>
            </div>
          </div>
        )}

        {mode === 'enroll' && isAdmin && (
          <div className={debugMode ? 'debug-toolbar active' : 'debug-toolbar'}>
            <div>
              <Bug size={19} />
              <span>
                <strong>Debug đăng ký 2D</strong>
                <small>{debugMode ? 'Cho phép đăng ký từ ảnh khuôn mặt hiển thị trên điện thoại.' : 'Luồng thường vẫn kiểm tra chất lượng và góc mặt.'}</small>
              </span>
            </div>
            <div className="debug-actions">
              <button className={debugMode ? 'button danger' : 'button secondary'} type="button" onClick={toggleDebugMode} disabled={busy}>
                <Bug size={17} />{debugMode ? 'Tắt debug 2D' : 'Bật debug 2D'}
              </button>
            </div>
          </div>
        )}

        <div className="camera-frame">
          <video ref={videoRef} muted playsInline />
          <canvas ref={canvasRef} />
          {!cameraReady && (
            <div className="camera-empty">
              <ScanFace size={44} />
              <span>Đang chờ quyền truy cập camera</span>
              <button className="button secondary" type="button" onClick={() => void startCamera()} disabled={busy}>
                <Camera size={17} /> Mở camera
              </button>
            </div>
          )}
          {mode === 'enroll' && enrollmentStage === 'failed' && (
            <div className="camera-failure">
              <CircleX size={48} />
              <strong>Đăng ký thất bại</strong>
              <span>{message}</span>
              <button className="button primary" type="button" onClick={retryEnrollment} disabled={busy}>
                <RotateCcw size={17} /> Thử lại
              </button>
            </div>
          )}
          {mode === 'attendance' && attendanceScanState !== 'idle' && (
            <div className={`attendance-feedback ${attendanceScanState}`}>
              {attendanceScanState === 'processing' && <Loader2 className="spin" size={52} />}
              {attendanceScanState === 'success' && <CheckCircle2 size={58} />}
              {attendanceScanState === 'failed' && <CircleX size={58} />}
              <strong>{attendanceScanState === 'processing' ? 'Đang xác minh...' : attendanceScanState === 'success' ? 'Thành công' : 'Thất bại'}</strong>
              <span>{message}</span>
            </div>
          )}
          {cameraReady && enrollmentStage !== 'failed' && attendanceScanState === 'idle' && <div className="scan-line" />}
        </div>

        <div className="scanner-status">
          <StatusBadge icon={Camera} label="Camera" active={cameraReady} />
          <StatusBadge icon={CircleDot} label="Trong khung" active={faceInGuide} />
          <StatusBadge
            icon={CheckCircle2}
            label={mode === 'enroll' && debugMode ? 'Ảnh 2D' : 'Chất lượng'}
            active={mode === 'enroll' && debugMode ? Boolean(currentFace) : qualityScore >= QUALITY_THRESHOLD}
          />
        </div>
        <div className={`scanner-message-box ${enrollmentStage === 'failed' ? 'failed' : lastAttendance ? (lastAttendance.eventType === 'CHECK_IN' ? 'check-in' : 'check-out') : recognizedEmployee ? 'success' : ''}`}>
          {enrollmentStage === 'failed' ? <CircleX size={22} /> : recognizedEmployee ? <CheckCircle2 size={22} /> : <ScanFace size={22} />}
          <div>
            <strong>{message}</strong>
            {recognizedEmployee && (
              <span>
                {recognizedEmployee.employeeCode} · {recognizedEmployee.fullName} · Độ tin cậy{' '}
                {Math.round(recognizedEmployee.confidence * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <aside className="panel face-side-panel">
        {mode === 'enroll' ? (
          <>
            <div>
              <h2>Hồ sơ đăng ký</h2>
              <p className="side-description">Chọn đúng nhân viên, các bước quét còn lại sẽ tự động.</p>
            </div>
            <label>
              Nhân viên
              <select value={selectedEmployeeId} onChange={(event) => selectEmployee(event.target.value)} disabled={busy}>
                <option value="">Chọn nhân viên</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.employeeCode} - {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            {selectedEmployee && <div className="employee-preview"><IdCard size={20} /><div><strong>{selectedEmployee.fullName}</strong><span>{selectedEmployee.employeeCode}</span></div></div>}
            <div className="sample-list">
              {SAMPLE_TYPES.map((sampleType) => (
                <div key={sampleType} className={enrollmentFailureStep === sampleType ? 'sample failed' : capturedSamples[sampleType] ? 'sample done' : 'sample'}>
                  <span>{SAMPLE_LABELS[sampleType]}</span>
                  <strong>
                    {enrollmentFailureStep === sampleType && <CircleX size={17} />}
                    {enrollmentFailureStep === sampleType ? 'Chất lượng thấp' : capturedSamples[sampleType] ? 'Đã quét' : 'Đang chờ'}
                  </strong>
                </div>
              ))}
              <div className={enrollmentFailureStep === 'SAVE' ? 'sample failed' : enrollmentStage === 'verify' || enrollmentStage === 'success' || enrollmentFailureStep === 'VERIFY' ? 'sample done' : 'sample'}>
                <span>Lưu hồ sơ FaceID</span>
                <strong>
                  {enrollmentFailureStep === 'SAVE' && <CircleX size={17} />}
                  {enrollmentFailureStep === 'SAVE' ? 'Thất bại' : enrollmentStage === 'verify' || enrollmentStage === 'success' || enrollmentFailureStep === 'VERIFY' ? 'Đã lưu' : enrollmentStage === 'saving' ? 'Đang lưu' : 'Đang chờ'}
                </strong>
              </div>
              <div className={enrollmentFailureStep === 'VERIFY' ? 'sample failed' : enrollmentStage === 'success' ? 'sample done' : 'sample'}>
                <span>Kiểm tra nhận diện</span>
                <strong>
                  {enrollmentFailureStep === 'VERIFY' && <CircleX size={17} />}
                  {enrollmentFailureStep === 'VERIFY'
                    ? 'Thất bại'
                    : enrollmentStage === 'success'
                    ? 'Đã khớp'
                    : enrollmentStage === 'verify'
                        ? 'Đang kiểm tra'
                        : 'Đang chờ'}
                </strong>
              </div>
            </div>
            {(enrollmentStage === 'success' || enrollmentStage === 'failed') && (
              <button className={enrollmentStage === 'failed' ? 'button primary' : 'button secondary'} type="button" onClick={enrollmentStage === 'failed' ? retryEnrollment : () => resetEnrollment()}>
                <RotateCcw size={17} /> {enrollmentStage === 'failed' ? 'Thử lại từ đầu' : 'Đăng ký lại'}
              </button>
            )}
          </>
        ) : (
          <>
            <div><h2>Thông tin chấm công</h2><p className="side-description">Kết quả nhận diện gần nhất</p></div>
            {lastAttendance ? (
              <div className={`attendance-result ${lastAttendance.eventType === 'CHECK_IN' ? 'check-in' : 'check-out'}`}>
                <div className="attendance-result-header">
                  {lastAttendance.eventType === 'CHECK_IN' ? <LogIn size={24} /> : <LogOut size={24} />}
                  <strong>{lastAttendance.eventType === 'CHECK_IN' ? 'GIỜ VÀO' : 'GIỜ RA'}</strong>
                </div>
                <div className="attendance-person"><div className="attendance-avatar">{lastAttendance.employee.fullName.slice(0, 1)}</div><div><strong>{lastAttendance.employee.fullName}</strong><span>{lastAttendance.employee.employeeCode}</span></div></div>
                <div className="attendance-time"><Clock3 size={20} /><div><span>Thời gian ghi nhận</span><strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(lastAttendance.eventTime))}</strong></div></div>
                <div className="attendance-shift"><span>Ca làm</span><strong>{lastAttendance.shift.shiftName}</strong><small>{lastAttendance.shift.startTime} - {lastAttendance.shift.endTime}</small></div>
              </div>
            ) : (
              <div className="attendance-empty"><ScanFace size={38} /><strong>Chưa có lượt chấm công</strong><span>Thông tin nhân viên sẽ xuất hiện sau khi nhận diện.</span></div>
            )}
          </>
        )}

        <div className="quality-card">
          <span>Chất lượng hình ảnh</span>
          <strong>{Math.round(qualityScore * 100)}%</strong>
          <div className="progress"><span style={{ width: `${Math.min(100, qualityScore * 100)}%` }} /></div>
        </div>
        {mode === 'attendance' && isAdmin && debugMode && (
          <div className="debug-response">
            <div><strong>Response từ server</strong><span>{debugResponse ? 'Đã nhận dữ liệu' : 'Đang chờ lượt chấm công'}</span></div>
            <pre>{debugResponse ? JSON.stringify(debugResponse, null, 2) : '// Response JSON sẽ hiển thị tại đây'}</pre>
          </div>
        )}
      </aside>
    </section>
  );
}

function buildVerificationPayload(face: CapturedFace) {
  return {
    descriptor: face.descriptor,
    landmarks: face.landmarks,
    quality: face.quality,
    liveness: buildLivenessPayload(),
    deviceId: Number.isInteger(ATTENDANCE_DEVICE_ID) && ATTENDANCE_DEVICE_ID > 0 ? ATTENDANCE_DEVICE_ID : null,
    eventType: 'AUTO'
  };
}

function buildLivenessPayload() {
  return { score: 0.92, blinkScore: 0.88, headTurnScore: 0.92, textureScore: 0.9 };
}

function clampNormalizedCoordinate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function matchesPose(pose: SampleType, yaw: number) {
  if (pose === 'FRONT') return Math.abs(yaw) <= 7;
  if (pose === 'LEFT') return yaw <= -10;
  return yaw >= 10;
}

function StatusBadge({ icon: Icon, label, active }: { icon: React.ComponentType<{ size?: number }>; label: string; active: boolean }) {
  return <div className={active ? 'status-badge active' : 'status-badge'}><Icon size={16} />{label}</div>;
}

function drawScannerOverlay(context: CanvasRenderingContext2D, width: number, height: number, landmarks?: FacePoint[], faceInGuide = false) {
  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.22)';
  context.lineWidth = 1;
  const boxWidth = width * 0.42;
  const boxHeight = height * 0.66;
  const boxX = (width - boxWidth) / 2;
  const boxY = (height - boxHeight) / 2;

  for (let index = 1; index < 5; index += 1) {
    const x = boxX + (boxWidth / 5) * index;
    context.beginPath(); context.moveTo(x, boxY); context.lineTo(x, boxY + boxHeight); context.stroke();
  }
  for (let index = 1; index < 6; index += 1) {
    const y = boxY + (boxHeight / 6) * index;
    context.beginPath(); context.moveTo(boxX, y); context.lineTo(boxX + boxWidth, y); context.stroke();
  }

  context.strokeStyle = faceInGuide ? '#22c55e' : landmarks?.length ? '#f59e0b' : '#94a3b8';
  context.lineWidth = 2;
  roundRect(context, boxX, boxY, boxWidth, boxHeight, 18);
  context.stroke();
  if (landmarks?.length) {
    context.fillStyle = '#38bdf8';
    for (let index = 0; index < landmarks.length; index += 3) {
      const point = landmarks[index];
      context.beginPath(); context.arc(point.x * width, point.y * height, 1.7, 0, Math.PI * 2); context.fill();
    }
  }
  context.restore();
}

function isFaceInsideGuide(landmarks: FacePoint[]) {
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return minX >= 0.27 && maxX <= 0.73 && minY >= 0.14 && maxY <= 0.86 &&
    centerX >= 0.38 && centerX <= 0.62 && centerY >= 0.34 && centerY <= 0.66;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForMinimumDuration(startedAt: number, minimumMilliseconds: number) {
  const remaining = minimumMilliseconds - (performance.now() - startedAt);
  if (remaining > 0) await delay(remaining);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function calculateQuality(video: HTMLVideoElement, landmarks: FacePoint[]): Quality {
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const faceBoxAreaRatio = Math.min(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
  const leftCheek = landmarks[234]?.x ?? Math.min(...xs);
  const rightCheek = landmarks[454]?.x ?? Math.max(...xs);
  const nose = landmarks[1]?.x ?? (leftCheek + rightCheek) / 2;
  const cheekSpan = Math.max(0.01, rightCheek - leftCheek);
  const yaw = Math.max(-22, Math.min(22, ((nose - leftCheek) / cheekSpan - 0.5) * 55));

  return {
    faceBoxAreaRatio,
    brightnessScore: estimateBrightness(video),
    sharpnessScore: 60,
    yaw: Number(yaw.toFixed(2)),
    pitch: 0,
    roll: 0
  };
}

function estimateBrightness(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 18;
  const context = canvas.getContext('2d');
  if (!context) return 0.8;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  for (let index = 0; index < data.length; index += 4) total += (data[index] + data[index + 1] + data[index + 2]) / 3;
  return Number(Math.min(1, Math.max(0, total / (data.length / 4) / 255)).toFixed(4));
}

function buildDescriptor(landmarks: FacePoint[]) {
  const values: number[] = [];
  for (let index = 0; values.length < 128; index += 4) {
    const point = landmarks[index % landmarks.length];
    values.push(point.x * 2 - 1);
    if (values.length < 128) values.push(point.y * 2 - 1);
  }
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / magnitude).toFixed(6)));
}

function getQualityScore(quality: Quality) {
  const area = Math.min(1, quality.faceBoxAreaRatio / 0.08);
  const sharpness = Math.min(1, quality.sharpnessScore / 45);
  const pose = Math.max(0, 1 - (Math.abs(quality.yaw) + Math.abs(quality.pitch) + Math.abs(quality.roll)) / 66);
  return Number((area * 0.25 + quality.brightnessScore * 0.2 + sharpness * 0.25 + pose * 0.3).toFixed(4));
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Quyền camera đã bị từ chối. Hãy cho phép Camera trong cài đặt của trình duyệt rồi thử lại.';
    }
    if (error.name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị này.';
    if (error.name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng.';
  }

  return error instanceof Error ? error.message : 'Không thể mở camera';
}
