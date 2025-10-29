#!/usr/bin/env python3
"""Convert MySQL dump to PostgreSQL format"""

import re

def convert_mysql_to_postgres(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove MySQL specific commands
    content = re.sub(r'/\*!.*?\*/;', '', content, flags=re.DOTALL)
    content = re.sub(r'SET .*?;', '', content)
    content = re.sub(r'USE `.*?`;', '', content)
    
    # Convert backticks to nothing (PostgreSQL doesn't need them for regular identifiers)
    content = content.replace('`', '')
    
    # Convert _binary '\0' to false and _binary '' to true
    content = re.sub(r"_binary '\\0'", 'false', content)
    content = re.sub(r"_binary ''", 'true', content)
    
    # Convert bit(1) to BOOLEAN
    content = re.sub(r'bit\(1\)', 'BOOLEAN', content, flags=re.IGNORECASE)
    
    # Convert INT AUTO_INCREMENT to SERIAL
    content = re.sub(r'int NOT NULL AUTO_INCREMENT', 'SERIAL', content, flags=re.IGNORECASE)
    content = re.sub(r'int\s+NOT\s+NULL\s+AUTO_INCREMENT', 'SERIAL', content, flags=re.IGNORECASE)
    
    # Convert datetime(6) to TIMESTAMP
    content = re.sub(r'datetime\(6\)', 'TIMESTAMP', content, flags=re.IGNORECASE)
    
    # Convert varchar to VARCHAR (already mostly compatible)
    # Convert int to INTEGER
    content = re.sub(r'\bint\b', 'INTEGER', content, flags=re.IGNORECASE)
    
    # Remove ENGINE and CHARSET clauses
    content = re.sub(r'ENGINE=\w+\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'DEFAULT CHARSET=[\w_]+', '', content, flags=re.IGNORECASE)
    content = re.sub(r'COLLATE=[\w_]+', '', content, flags=re.IGNORECASE)
    content = re.sub(r'AUTO_INCREMENT=\d+', '', content, flags=re.IGNORECASE)
    
    # Convert KEY to INDEX (but keep PRIMARY KEY)
    content = re.sub(r'\bKEY\s+([^\(]+)', r'INDEX \1', content)
    
    # Remove UNIQUE KEY and convert to UNIQUE
    content = re.sub(r'UNIQUE KEY `([^`]+)` \(([^\)]+)\)', r'UNIQUE (\2)', content)
    
    # Fix CONSTRAINT names (remove backticks)
    content = re.sub(r'CONSTRAINT `([^`]+)`', r'CONSTRAINT \1', content)
    
    # Fix PRIMARY KEY lines that might have extra commas
    content = re.sub(r',(\s*PRIMARY KEY)', r'\1', content)
    
    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Converted {input_file} to {output_file}")

if __name__ == '__main__':
    convert_mysql_to_postgres('quiz_system_export.sql', 'quiz_system_postgres.sql')
    print("Conversion complete!")
