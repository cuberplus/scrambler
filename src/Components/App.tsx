import React from 'react';
import "../CSS/Style.css";
import { Row, Col, Card, Navbar, Button } from 'react-bootstrap'

function App() {
  return (
    <div className="App">
      <header className={"header"}>
        <Navbar>
          <Navbar.Brand>
            CuberPlus
          </Navbar.Brand>
        </Navbar>
      </header>
      <Row style={{ margin: 10 }}>
        <Col className='col-lg-6'>
          <Card className='p-3'>
            <a href='/cubeastanalyzer' className='stretched-link'>
              <h3>
                Cubeast Analyzer
              </h3>
            </a>
            <img
              src={require("../Assets/CubeastAnalyzer.png")}
              style={{ border: '1px solid #000000' }}
            >
            </img>
          </Card>
        </Col>

        <Col className='col-lg-6'>
          <Card className='p-3'>
            <a href='/' className='stretched-link'>
              <h3>
                More Coming Soon...
              </h3>
            </a>
          </Card>
        </Col>
      </Row>

    </div>
  );
}

export default App;
