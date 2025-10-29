# -*- coding: utf-8 -*-
from pathlib import Path
path = Path(r'src/pages/AbiturPage.jsx')
text = path.read_text(encoding='utf-8')
old = "      <Modal\n        isOpen={isEditOpen}\n        onClose={() => setIsEditOpen(false)}\n        mode=\"edit-student\"\n        student={studentToEdit}\n        onStudentUpdated={(updated) => {\n          setStudents(prev => prev.map(s => s.studentId === updated.studentId ? updated : s));\n        }}\n      />\n\n"
new = old + "      <StudentHistoryModal\n        isOpen={isHistoryOpen && Boolean(historyStudent)}\n        onClose={() => setIsHistoryOpen(false)}\n        student={historyStudent}\n      />\n\n"
if new.count('StudentHistoryModal') > 1 and old in text:
    pass
if 'StudentHistoryModal' in text:
    # avoid duplicate insertion
    raise SystemExit('history modal already inserted')
text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
