<?php
// POST /api/send.php  { slug, format, to }
// Emails a hosted work's download to a reader's Kindle or inbox through the Hostinger mailbox
// books@islamicarchives.org. The mail settings (config.php) and PHPMailer (vendor/) are added
// by the GitHub deploy workflow from the repository's secrets; neither is stored in the repository.

header('Content-Type: application/json');

function reply($body, $status = 200) {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(['error' => 'Use POST.'], 405);

$configFile = __DIR__ . '/config.php';
$autoload = __DIR__ . '/vendor/autoload.php';
if (!is_file($configFile) || !is_file($autoload)) reply(['error' => 'Sending is not switched on yet. Please download the file instead.'], 503);
$cfg = require $configFile;
if (empty($cfg['smtp_user']) || empty($cfg['smtp_password'])) reply(['error' => 'Sending is not switched on yet. Please download the file instead.'], 503);
require $autoload;

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$slug = (string)($in['slug'] ?? '');
$format = (string)($in['format'] ?? 'epub');
$to = trim((string)($in['to'] ?? ''));

$types = [
    'epub' => 'application/epub+zip',
    'pdf'  => 'application/pdf',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
if (!preg_match('/^[a-z0-9][a-z0-9-]{0,120}$/', $slug)) reply(['error' => 'Unknown work.'], 400);
if (!isset($types[$format])) reply(['error' => 'Unsupported format.'], 400);
if (!filter_var($to, FILTER_VALIDATE_EMAIL) || strlen($to) > 254) reply(['error' => 'Please enter a valid email address.'], 400);
$kindle = (bool)preg_match('/@(free\.)?kindle\.com$/i', $to);
if ($kindle && $format !== 'epub') reply(['error' => 'Kindle copies are sent as EPUB.'], 400);

$file = realpath(__DIR__ . '/../downloads/' . $slug . '.' . $format);
$dir = realpath(__DIR__ . '/../downloads');
if (!$file || !$dir || strpos($file, $dir) !== 0 || !is_file($file)) reply(['error' => 'That file is not available.'], 404);
if (filesize($file) > 20 * 1024 * 1024) reply(['error' => 'This file is too large to send. Please download it instead.'], 413);

// simple limit: 10 sends per address per day
$limitDir = sys_get_temp_dir() . '/ia-send-limits';
@mkdir($limitDir, 0700, true);
$key = $limitDir . '/' . hash('sha256', strtolower($to) . date('Y-m-d'));
$used = is_file($key) ? (int)file_get_contents($key) : 0;
if ($used >= 10) reply(['error' => 'Daily sending limit reached for this address. Please try again tomorrow.'], 429);

$host = $_SERVER['HTTP_HOST'] ?? 'islamicarchives.org';
$pageUrl = 'https://' . $host . '/works/' . $slug . '/';

$mail = new PHPMailer\PHPMailer\PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = $cfg['smtp_host'];
    $mail->Port = (int)$cfg['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    $mail->Username = $cfg['smtp_user'];
    $mail->Password = $cfg['smtp_password'];
    $mail->CharSet = 'UTF-8';
    $mail->setFrom($cfg['smtp_user'], $cfg['from_name'] ?? 'Islamic Archives');
    $mail->addAddress($to);
    $mail->Subject = $kindle ? 'Islamic Archives delivery' : 'Your book from Islamic Archives';
    $mail->Body = "Attached is the " . strtoupper($format) . " you asked for.\n\nWork page: $pageUrl\n\n"
        . "You received this because someone entered this address at islamicarchives.org. If that wasn't you, you can ignore this message.";
    $mail->addAttachment($file, $slug . '.' . $format, 'base64', $types[$format]);
    $mail->send();
} catch (Exception $e) {
    reply(['error' => 'Sorry, sending failed. Please try again later.'], 502);
}

file_put_contents($key, (string)($used + 1));
reply(['ok' => true]);
