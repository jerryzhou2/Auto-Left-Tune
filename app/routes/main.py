import os
import uuid
from flask import Blueprint, request, send_file, render_template, jsonify
from werkzeug.utils import secure_filename
from app.config.config import Config
from app.models.session import SessionManager
from app.utils import transform

main = Blueprint('main', __name__)
session_manager = SessionManager()

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件部分'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and file.filename.endswith('.mid'):
        # 生成会话ID并保存文件
        session_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        input_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_{filename}")
        output_midi_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.mid")
        output_pdf_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.pdf")
        
        file.save(input_path)
        
        # 处理MIDI文件
        if not transform.split_midi(input_path, output_midi_path):
            return jsonify({'error': 'MIDI处理失败'}), 500
            
        # 直接生成PDF
        if not transform.export_pdf(output_midi_path, output_pdf_path):
            return jsonify({'error': 'PDF生成失败'}), 500
        
        # 保存会话数据
        session_data = {
            'original_filename': filename,
            'input_path': input_path,
            'output_midi_path': output_midi_path,
            'output_pdf_path': output_pdf_path
        }
        session_manager.create_session(session_id, session_data)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': '文件已成功处理，PDF已生成',
            'converted_midi_name': f"converted_{filename}",
            'converted_pdf_name': filename.replace('.mid', '.pdf')
        })
    
    return jsonify({'error': '只支持MIDI文件格式'}), 400

@main.route('/convert-to-pdf/<session_id>', methods=['GET'])
def convert_to_pdf(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 使用转换后的MIDI文件而不是原始文件
    input_path = session['output_midi_path']
    output_pdf_path = session['output_pdf_path']
    
    # 调用transform.py的PDF转换函数
    success = transform.export_pdf(input_path, output_pdf_path)
    
    if success:
        return jsonify({
            'success': True,
            'message': 'PDF已生成'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'PDF生成失败'
        }), 500

@main.route('/download/<file_type>/<session_id>', methods=['GET'])
def download_file(file_type, session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    if file_type == 'midi':
        file_path = session['output_midi_path']
        return send_file(file_path, as_attachment=True, download_name=f"converted_{session['original_filename']}")
    elif file_type == 'pdf':
        file_path = session['output_pdf_path']
        return send_file(file_path, as_attachment=True, download_name=f"{session['original_filename'].replace('.mid', '.pdf')}")
    else:
        return jsonify({'error': '未知文件类型'}), 400

@main.route('/session/<session_id>', methods=['GET'])
def get_session(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'exists': False})
    
    return jsonify({
        'exists': True,
        'filename': session['original_filename'],
        'converted_midi_name': f"converted_{session['original_filename']}",
        'converted_pdf_name': session['original_filename'].replace('.mid', '.pdf')
    })

@main.route('/view-pdf/<session_id>', methods=['GET'])
def view_pdf(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    file_path = session['output_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'PDF文件不存在'}), 404
        
    return send_file(file_path, mimetype='application/pdf')

@main.route('/export-original-pdf/<session_id>', methods=['GET'])
def export_original_pdf(session_id):
    """
    导出原始MIDI文件的PDF（转换前的）
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    input_path = session['input_path']
    original_pdf_path = os.path.join(Config.OUTPUT_FOLDER, f"original_{session_id}.pdf")
    
    # 调用transform.py的PDF转换函数处理原始MIDI文件
    success = transform.export_pdf(input_path, original_pdf_path)
    
    if success:
        # 将原始PDF路径添加到会话数据中
        session['original_pdf_path'] = original_pdf_path
        session_manager.create_session(session_id, session)
        
        return jsonify({
            'success': True,
            'message': '原始MIDI的PDF已生成'
        })
    else:
        return jsonify({
            'success': False,
            'error': '原始MIDI的PDF生成失败'
        }), 500

@main.route('/view-original-pdf/<session_id>', methods=['GET'])
def view_original_pdf(session_id):
    """
    查看原始MIDI文件的PDF
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果原始PDF路径不存在，先生成
    if 'original_pdf_path' not in session:
        return jsonify({'error': '请先生成原始MIDI的PDF'}), 400
    
    file_path = session['original_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI的PDF文件不存在'}), 404
        
    return send_file(file_path, mimetype='application/pdf')

@main.route('/download-original-pdf/<session_id>', methods=['GET'])
def download_original_pdf(session_id):
    """
    下载原始MIDI文件的PDF
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果原始PDF路径不存在，先生成
    if 'original_pdf_path' not in session:
        return jsonify({'error': '请先生成原始MIDI的PDF'}), 400
    
    file_path = session['original_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI的PDF文件不存在'}), 404
        
    return send_file(file_path, as_attachment=True, 
                    download_name=f"original_{session['original_filename'].replace('.mid', '.pdf')}")

@main.route('/download/original-midi/<session_id>', methods=['GET'])
def download_original_midi(session_id):
    """
    获取原始MIDI文件（转换前的）
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    file_path = session['input_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI文件不存在'}), 404
        
    return send_file(file_path, mimetype='audio/midi') 