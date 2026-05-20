import os

# Directory containing the PDF files
pdf_directory = './'
index_file_path = os.path.join(pdf_directory, 'index.js')

def format_js_variable_name(filename):
    # Remove file extension and replace spaces and invalid characters
    name = filename.replace('.pdf', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    # Additional formatting can be added here as necessary
    return name

def create_index_js(pdf_dir, index_path):
    with open(index_path, 'w') as index_file:
        for filename in os.listdir(pdf_dir):
            if filename.endswith('.pdf'):
                js_var_name = format_js_variable_name(filename)
                relative_path = f'./{filename}'
                # Write the import statement
                index_file.write(f"import {js_var_name} from '{relative_path}';\n")
        
        # Write the export block
        index_file.write('\n// Export them as named exports\nexport {\n')
        for filename in os.listdir(pdf_dir):
            if filename.endswith('.pdf'):
                js_var_name = format_js_variable_name(filename)
                index_file.write(f"  {js_var_name},\n")
        index_file.write('};\n')

# Replace '/path/to/your/pdf/folder' with the actual path to your PDFs folder
create_index_js(pdf_directory, index_file_path)
