UPDATE `Attachment`
SET `type` = CASE
  WHEN `mimeType` LIKE 'image/%' THEN 'IMAGE'
  WHEN `mimeType` LIKE 'video/%' THEN 'VIDEO'
  WHEN `mimeType` LIKE 'audio/%' THEN 'AUDIO'
  WHEN `mimeType` LIKE '%zip%' THEN 'ARCHIVE'
  ELSE 'DOCUMENT'
END;
